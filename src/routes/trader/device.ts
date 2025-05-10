import { Elysia, t } from "elysia";
import { db } from "@/db";
import ErrorSchema from "@/types/error";
import { randomBytes } from "crypto";

/* ---------- DTOs ---------- */
// Success response DTO
const SuccessResponseDTO = t.Object({
  status: t.String({
    description: "Status of the operation (success or error)",
    examples: ["success"],
  }),
  message: t.String({
    description: "Message describing the result",
    examples: ["Device info updated", "Notification received"],
  }),
});

// Error response DTO
const ErrorResponseDTO = t.Object({
  status: t.String({
    description: "Status of the operation (success or error)",
    examples: ["error"],
  }),
  message: t.String({
    description: "Error message describing what went wrong",
    examples: [
      "Device not found or invalid token",
      "No available bank details to assign to device",
    ],
  }),
});

// Authentication headers
const AuthHeaders = t.Object({
  authorization: t.String({
    description: "Bearer token for device authentication",
    examples: ["Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."],
  }),
});

// Device connect DTO based on documentation
const DeviceConnectDTO = t.Object({
  deviceCode: t.String({
    description: "Unique device identifier code",
    examples: ["ABC123"],
  }),
  batteryLevel: t.Number({
    description: "Current battery level percentage",
    examples: [85],
  }),
  networkInfo: t.String({
    description: "Current network connection type",
    examples: ["Wi-Fi"],
  }),
  deviceModel: t.String({
    description: "Device model name",
    examples: ["Google Pixel 7"],
  }),
  androidVersion: t.String({
    description: "Android version running on the device",
    examples: ["13"],
  }),
  appVersion: t.String({
    description: "Application version installed on the device",
    examples: ["1.0"],
  }),
});

// Device connect response DTO
const DeviceConnectResponseDTO = t.Object({
  status: t.String({
    description: "Status of the connection request",
    examples: ["success"],
  }),
  token: t.String({
    description: "Authentication token for future requests",
    examples: ["eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."],
  }),
  message: t.String({
    description: "Message describing the result",
    examples: ["Device connected successfully"],
  }),
});

// Device info update DTO - a more flexible version
const DeviceInfoUpdateDTO = t.Object(
  {
    batteryLevel: t.Optional(
      t.Number({
        description: "Current battery level percentage",
        examples: [75],
      }),
    ),
    isCharging: t.Optional(
      t.Boolean({
        description: "Whether the device is currently charging",
        examples: [true],
      }),
    ),
    networkInfo: t.Optional(
      t.String({
        description: "Current network connection type",
        examples: ["Mobile Data (4G)"],
      }),
    ),
    timestamp: t.Optional(
      t.Number({
        description: "Unix timestamp in milliseconds",
        examples: [1716717635423],
      }),
    ),
    deviceModel: t.Optional(
      t.String({
        description: "Device model name",
        examples: ["Google Pixel 7"],
      }),
    ),
    androidVersion: t.Optional(
      t.String({
        description: "Android version running on the device",
        examples: ["13"],
      }),
    ),
    type: t.Optional(
      t.String({
        description: "Custom type field for categorizing updates",
        examples: ["STATUS_UPDATE", "LOCATION_UPDATE"],
      }),
    ),
    energy: t.Optional(
      t.Union([
        t.Number({
          description: "Custom energy level field",
          examples: [85],
        }),
        t.Null(),
      ]),
    ),
    ethernetSpeed: t.Optional(
      t.Union([
        t.Number({
          description: "Network connection speed in Mbps",
          examples: [100],
        }),
        t.Null(),
      ]),
    ),
    location: t.Optional(
      t.String({
        description: "Device location information",
        examples: ["37.7749,-122.4194"],
      }),
    ),
    additionalInfo: t.Optional(
      t.String({
        description: "Any additional information as JSON string",
        examples: ['{"temperature":25,"humidity":60}'],
      }),
    ),
  },
  {
    additionalProperties: true,
    description:
      "The device update accepts any additional custom fields besides the documented ones",
  },
);

// Device notification DTO
const DeviceNotificationDTO = t.Object({
  packageName: t.String({
    description: "Package name of the app that generated the notification",
    examples: ["com.example.app"],
  }),
  appName: t.String({
    description: "Display name of the app that generated the notification",
    examples: ["Example App"],
  }),
  title: t.String({
    description: "Title of the notification",
    examples: ["New Message"],
  }),
  content: t.String({
    description: "Content of the notification",
    examples: ["Hello, how are you?"],
  }),
  timestamp: t.Number({
    description:
      "Unix timestamp in milliseconds when notification was received",
    examples: [1716717645212],
  }),
  priority: t.Number({
    description: "Priority level of the notification",
    examples: [1],
  }),
  category: t.String({
    description: "Category of the notification",
    examples: ["msg"],
  }),
});

/* ---------- helpers ---------- */
const generateToken = () => randomBytes(32).toString("hex");

/* ---------- device auth middleware ---------- */
const withDeviceAuth = async ({ headers, error, set }) => {
  try {
    const authHeader = headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      set.status = 401;
      return error(401, {
        status: "error",
        message: "Unauthorized: Missing or invalid token",
      });
    }

    const token = authHeader.replace("Bearer ", "");

    const device = await db.device.findFirst({
      where: { token },
    });

    if (!device) {
      set.status = 401;
      return error(401, {
        status: "error",
        message: "Device not found or invalid token",
      });
    }

    return { device };
  } catch (err) {
    console.error("Error in device authentication:", err);
    set.status = 500;
    return error(500, {
      status: "error",
      message: "Internal server error during authentication",
    });
  }
};

export default new Elysia()
  // Simple test endpoint that ALWAYS returns the exact required format
  .get(
    "/ping", 
    () => ({ 
      status: "success", 
      message: "Device API is working" 
    })
  )
  .post(
    "/connect",
    async ({ body, error }) => {
      try {
        // Find a bank detail matching the device code
        const bankDetail = await db.bankDetail.findFirst({
          where: {
            id: body.deviceCode, // Using deviceCode directly as bankDetailId
            isArchived: false,
          },
        });

        if (!bankDetail) {
          return error(400, {
            status: "error",
            message:
              "Invalid device code or no available bank details to assign to device",
          });
        }

        // Check if this bank detail already has a device
        const existingDevice = await db.device.findFirst({
          where: {
            bankDetailId: bankDetail.id,
          },
        });

        // If there's an existing device, delete it
        if (existingDevice) {
          await db.notification.deleteMany({
            where: {
              deviceId: existingDevice.id,
            },
          });

          await db.device.delete({
            where: {
              id: existingDevice.id,
            },
          });
        }

        // Generate a token for the new device
        const token = generateToken();

        // Create a new device
        await db.device.create({
          data: {
            name: `${body.deviceModel} (${body.deviceCode})`,
            energy: null, // Allow null values
            ethernetSpeed: null, // Allow null values
            isOnline: true,
            token,
            bankDetailId: bankDetail.id,
          },
        });

        // Using explicit object with required fields
        return {
          status: "success",
          token: token,
          message: "Device connected successfully",
        };
      } catch (err) {
        console.error("Error connecting device:", err);
        return error(500, {
          status: "error",
          message: "Internal server error occurred while connecting device",
        });
      }
    },
    {
      body: DeviceConnectDTO,
      response: {
        200: DeviceConnectResponseDTO,
        400: ErrorResponseDTO,
      },
    },
  )
  .post(
    "/info/update",
    async ({ body, device, error }) => {
      try {
        if (!device || !device.id) {
          return error(401, {
            status: "error",
            message: "Device authentication failed",
          });
        }

        // Update device info based on the request
        const updateData = {
          isOnline: true,
        };

        // Transfer all specific DB fields we want to store
        if (body.batteryLevel !== undefined)
          updateData.energy = body.batteryLevel;
        if (body.energy !== undefined) updateData.energy = body.energy;
        if (body.ethernetSpeed !== undefined)
          updateData.ethernetSpeed = body.ethernetSpeed;

        // Update the device with all the gathered data
        await db.device.update({
          where: { id: device.id },
          data: updateData,
        });

        // Using explicit object with required fields
        return {
          status: "success",
          message: "Device info updated",
        };
      } catch (err) {
        console.error("Error updating device info:", err);
        return error(500, {
          status: "error",
          message: "Internal server error occurred while updating device info",
        });
      }
    },
    {
      beforeHandle: [withDeviceAuth],
      headers: AuthHeaders,
      body: DeviceInfoUpdateDTO,
      response: {
        200: SuccessResponseDTO,
        401: ErrorResponseDTO,
      },
    },
  )
  .post(
    "/notification",
    async ({ body, device, error }) => {
      try {
        if (!device || !device.id) {
          return error(401, {
            status: "error",
            message: "Device authentication failed",
          });
        }

        // Create notification in database
        await db.notification.create({
          data: {
            type: "AppNotification",
            application: body.appName,
            message: `${body.title}: ${body.content}`,
            deviceId: device.id,
          },
        });

        // Using explicit object with required fields
        return {
          status: "success",
          message: "Notification received",
        };
      } catch (err) {
        console.error("Error processing notification:", err);
        return error(500, {
          status: "error",
          message:
            "Internal server error occurred while processing notification",
        });
      }
    },
    {
      beforeHandle: [withDeviceAuth],
      headers: AuthHeaders,
      body: DeviceNotificationDTO,
      response: {
        200: SuccessResponseDTO,
        401: ErrorResponseDTO,
      },
    },
  );