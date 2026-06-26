const { occasions } = require("./occasion-data");

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

function createOpenApi(port) {
  return {
    openapi: "3.0.3",
    info: {
      title: "Invitation Studio API",
      version: "2.0.0",
      description: "Authenticated API for managing user-owned invitations. Login and registration return an HttpOnly session cookie."
    },
    servers: [{ url: `http://127.0.0.1:${port}` }],
    tags: [
      { name: "Authentication" },
      { name: "Occasions" },
      { name: "Invitations" }
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
