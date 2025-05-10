# Chase API Documentation

This document provides detailed information about the API endpoints used by the Chase application, including request/response formats and required headers.

## Base URL

All API requests use the base URL configured in the application settings. Default format:
```
https://api.example.com
```

## Authentication

Most endpoints require authentication using a token obtained from the `/api/device/connect` endpoint.

**Authentication Header:**
```
Authorization: Bearer {token}
```

## Endpoints

### 1. Device Connection

**Endpoint:** `/api/device/connect`  
**Method:** POST  
**Description:** Establishes initial connection with the server using a device code.

**Request Headers:**
- `Content-Type: application/json`

**Request Body:**
```json
{
  "deviceCode": "ABC123",
  "batteryLevel": 85,
  "networkInfo": "Wi-Fi",
  "deviceModel": "Google Pixel 7",
  "androidVersion": "13",
  "appVersion": "1.0"
}
```

**Response:**
```json
{
  "status": "success",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "message": "Device connected successfully"
}
```

**Error Response:**
```json
{
  "status": "error",
  "message": "Invalid device code"
}
```

### 2. Device Information Update

**Endpoint:** `/api/device/info/update`  
**Method:** POST  
**Description:** Sends periodic device information updates to the server.

**Request Headers:**
- `Content-Type: application/json`
- `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "batteryLevel": 75,
  "isCharging": true,
  "networkInfo": "Mobile Data (4G)",
  "timestamp": 1716717635423,
  "deviceModel": "Google Pixel 7",
  "androidVersion": "13"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Device info updated"
}
```

**Error Response:**
```json
{
  "status": "error",
  "message": "Unauthorized access"
}
```

### 3. Notification Forwarding

**Endpoint:** `/api/device/notification`  
**Method:** POST  
**Description:** Forwards captured device notifications to the server.

**Request Headers:**
- `Content-Type: application/json`
- `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "packageName": "com.example.app",
  "appName": "Example App",
  "title": "New Message",
  "content": "Hello, how are you?",
  "timestamp": 1716717645212,
  "priority": 1,
  "category": "msg"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Notification received"
}
```

**Error Response:**
```json
{
  "status": "error",
  "message": "Invalid notification format"
}
```

## Status Codes

- **200 OK**: The request was successful
- **400 Bad Request**: The server could not understand the request
- **401 Unauthorized**: Authentication failed
- **403 Forbidden**: The client does not have access rights to the content
- **404 Not Found**: The server cannot find the requested resource
- **500 Internal Server Error**: The server encountered an unexpected condition

## API Implementation Details

The Chase application implements these API calls using Retrofit with OkHttp as the HTTP client. Here's how the API is structured in the app:

1. **RetrofitClient**: Configures the Retrofit instance with the base URL and OkHttp client.
2. **ApiService**: Interface that defines the API endpoints.
3. **ApiManager**: Handles API calls and provides callback methods for success/failure.
4. **PreferenceManager**: Stores the API token and endpoint.

The app sends device information updates every 2 minutes using a foreground service, and notifications are sent in real-time as they are captured.

## Error Handling

The app implements a robust error handling mechanism:

1. Network connectivity issues trigger retry attempts with exponential backoff.
2. Authentication failures prompt the user to re-enter the device code.
3. Server errors are logged and reported to the user when appropriate.

## Security Considerations

- All API communication uses HTTPS
- Authentication tokens are stored securely
- Sensitive notification content is handled according to privacy best practices