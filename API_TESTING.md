# Relevant API Testing

## Test the API endpoints

### 1. Test server status
```bash
curl http://localhost:5000/
```

### 2. Register a new user
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "testpassword123", "name": "Test User"}'
```

### 3. Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "testpassword123"}'
```

### 4. Get user profile (replace YOUR_TOKEN with actual token from login)
```bash
curl -X GET http://localhost:5000/api/auth/me \
  -H "x-auth-token: YOUR_TOKEN"
```

### 5. Update interests
```bash
curl -X PUT http://localhost:5000/api/user/interests \
  -H "Content-Type: application/json" \
  -H "x-auth-token: YOUR_TOKEN" \
  -d '{"interests": ["AI", "Machine Learning", "Web Development"]}'
```

### 6. Add YouTube channel
```bash
curl -X POST http://localhost:5000/api/user/youtube-sources \
  -H "Content-Type: application/json" \
  -H "x-auth-token: YOUR_TOKEN" \
  -d '{"channelId": "UC_x5XG1OV2P6uZZ5FSM9Ttw", "channelName": "Google for Developers"}'
```

### 7. Get content feed
```bash
curl -X GET http://localhost:5000/api/content/feed \
  -H "x-auth-token: YOUR_TOKEN"
```

## PowerShell Testing (Windows)
Use Invoke-RestMethod instead of curl if needed:

```powershell
# Test server
Invoke-RestMethod -Uri "http://localhost:5000/" -Method Get

# Register user
$body = @{
    email = "test@example.com"
    password = "testpassword123"
    name = "Test User"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5000/api/auth/register" -Method Post -Body $body -ContentType "application/json"
```
