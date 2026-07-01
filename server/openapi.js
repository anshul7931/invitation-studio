const { occasions } = require("./occasion-schema");

const fields = Object.fromEntries(
  [...new Set(Object.values(occasions).flatMap(({ defaults }) => Object.keys(defaults)))]
    .map((name) => [name, { type: "string" }])
);

const occasionParameter = {
  name: "occasion",
  in: "path",
  required: true,
  schema: { type: "string", enum: Object.keys(occasions) }
};

const idParameter = {
  name: "id",
  in: "path",
  required: true,
  schema: { type: "string", format: "uuid" }
};

const body = (schema) => ({
  required: true,
  content: { "application/json": { schema } }
});

function createOpenApi(host, port) {
  return {
    openapi: "3.0.3",
    info: {
      title: "Invitation Studio API",
      version: "2.0.0",
      description: "Authenticated API for managing user-owned invitations. Login and registration return an HttpOnly session cookie."
    },
    servers: [{ url: `http://${host}:${port}` }],
    tags: [
      { name: "Authentication" },
      { name: "Profile" },
      { name: "Occasions" },
      { name: "Invitations" },
      { name: "Public" },
      { name: "Admin" }
    ],
    paths: {
      "/api/auth/register": {
        post: {
          tags: ["Authentication"],
          summary: "Register a user",
          requestBody: body({ $ref: "#/components/schemas/RegisterRequest" }),
          responses: {
            201: { description: "Registered and logged in" },
            400: { description: "Invalid details" },
            409: { description: "Email already exists" }
          }
        }
      },
      "/api/auth/login": {
        post: {
          tags: ["Authentication"],
          summary: "Login",
          requestBody: body({ $ref: "#/components/schemas/LoginRequest" }),
          responses: {
            200: { description: "Logged in" },
            401: { description: "Invalid credentials" }
          }
        }
      },
      "/api/auth/me": {
        get: {
          tags: ["Authentication"],
          summary: "Get current user",
          responses: { 200: { description: "Current user or null" } }
        }
      },
      "/api/auth/logout": {
        post: {
          tags: ["Authentication"],
          summary: "Logout",
          responses: { 200: { description: "Session cleared" } }
        }
      },
      "/api/profile": {
        put: {
          tags: ["Profile"],
          summary: "Update the signed-in user's display name",
          security: [{ cookieAuth: [] }],
          requestBody: body({
            type: "object",
            required: ["name", "email"],
            properties: {
              name: { type: "string", example: "Aisha Sharma" },
              email: { type: "string", format: "email", example: "aisha@example.com" },
              phone: { type: "string", example: "99999 88888" }
            }
          }),
          responses: {
            200: { description: "Profile updated" },
            400: { description: "Invalid profile details" },
            409: { description: "Email already exists" },
            401: { description: "Authentication required" }
          }
        }
      },
      "/api/occasions": {
        get: {
          tags: ["Occasions"],
          summary: "List supported occasions",
          responses: { 200: { description: "Occasion list" } }
        }
      },
      "/api/occasions/{occasion}": {
        get: {
          tags: ["Occasions"],
          summary: "Get defaults and required fields",
          parameters: [occasionParameter],
          responses: {
            200: { description: "Occasion configuration" },
            404: { description: "Unknown occasion" }
          }
        }
      },
      "/api/invitations": {
        get: {
          tags: ["Invitations"],
          summary: "List the current user's saved invitations",
          security: [{ cookieAuth: [] }],
          responses: {
            200: { description: "Invitation list" },
            401: { description: "Authentication required" }
          }
        }
      },
      "/api/invitations/{occasion}": {
        post: {
          tags: ["Invitations"],
          summary: "Create and save an invitation",
          security: [{ cookieAuth: [] }],
          parameters: [occasionParameter],
          requestBody: body({ $ref: "#/components/schemas/InvitationFields" }),
          responses: {
            201: { description: "Invitation saved" },
            400: { description: "Missing fields" },
            401: { description: "Authentication required" },
            404: { description: "Unknown occasion" }
          }
        }
      },
      "/api/invitations/{occasion}/{id}": {
        get: {
          tags: ["Invitations"],
          summary: "Get one owned invitation",
          security: [{ cookieAuth: [] }],
          parameters: [occasionParameter, idParameter],
          responses: {
            200: { description: "Invitation" },
            401: { description: "Authentication required" },
            404: { description: "Not found" }
          }
        },
        put: {
          tags: ["Invitations"],
          summary: "Update an owned invitation",
          security: [{ cookieAuth: [] }],
          parameters: [occasionParameter, idParameter],
          requestBody: body({ $ref: "#/components/schemas/InvitationFields" }),
          responses: {
            200: { description: "Updated invitation" },
            400: { description: "Missing fields" },
            401: { description: "Authentication required" },
            404: { description: "Not found" }
          }
        },
        delete: {
          tags: ["Invitations"],
          summary: "Delete an owned invitation",
          security: [{ cookieAuth: [] }],
          parameters: [occasionParameter, idParameter],
          responses: {
            204: { description: "Deleted" },
            401: { description: "Authentication required" },
            404: { description: "Not found" }
          }
        }
      },
      "/api/invitations/{occasion}/{id}/share": {
        post: {
          tags: ["Invitations"],
          summary: "Generate a one-time 10-minute public read-only link",
          security: [{ cookieAuth: [] }],
          parameters: [occasionParameter, idParameter],
          responses: {
            200: { description: "Public link generated" },
            402: { description: "Public link already generated; payment required" },
            409: { description: "Same details were previously made public" }
          }
        }
      },
      "/api/public/{token}": {
        get: {
          tags: ["Public"],
          summary: "Read a public invitation while the link is active",
          parameters: [{
            name: "token",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" }
          }],
          responses: {
            200: { description: "Read-only invitation" },
            404: { description: "Not found or expired" }
          }
        }
      },
      "/api/admin/stats": {
        get: {
          tags: ["Admin"],
          summary: "Admin application statistics",
          security: [{ cookieAuth: [] }],
          responses: { 200: { description: "Stats" }, 403: { description: "Admin required" } }
        }
      },
      "/api/admin/users": {
        get: {
          tags: ["Admin"],
          summary: "List all users",
          security: [{ cookieAuth: [] }],
          responses: { 200: { description: "Users" }, 403: { description: "Admin required" } }
        }
      },
      "/api/admin/invitations": {
        get: {
          tags: ["Admin"],
          summary: "List all cards, optionally filtered by userId",
          security: [{ cookieAuth: [] }],
          parameters: [{
            name: "userId",
            in: "query",
            required: false,
            schema: { type: "string", format: "uuid" }
          }],
          responses: { 200: { description: "Invitations" }, 403: { description: "Admin required" } }
        }
      }
    },
    components: {
      securitySchemes: {
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "invitation_session",
          description: "Postman should retain the cookie returned by register or login."
        }
      },
      schemas: {
        RegisterRequest: {
          type: "object",
          required: ["name", "email", "password"],
          properties: {
            name: { type: "string", example: "Aisha Sharma" },
            email: { type: "string", format: "email", example: "aisha@example.com" },
            phone: { type: "string", example: "99999 88888" },
            password: { type: "string", format: "password", minLength: 8, example: "secret123" }
          }
        },
        LoginRequest: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", format: "password" }
          }
        },
        InvitationFields: {
          type: "object",
          additionalProperties: false,
          properties: fields
        }
      }
    }
  };
}

module.exports = { createOpenApi };
