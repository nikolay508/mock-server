# Classroom mock server

A small local API for teaching HTTP with Postman. Requires Node.js 18 or newer. No installation or dependencies needed.

## Start

```sh
npm start
```

The API runs at **http://127.0.0.1:3000**. Leave the terminal running. Stop it with Ctrl+C.

To choose a different port: `PORT=3001 npm start`.

## Use Postman

1. Open the Postman desktop app (or the web app with the Desktop Agent).
2. Click **Import** and select `classroom.postman_collection.json` from this folder.
3. Open the imported **Classroom Mock API** collection and send the requests in order.

The collection includes a `baseUrl` variable and automatically saves the ID returned by **Create user** for the next requests. Change `baseUrl` if you use another port. Each request includes an explanation and a status-code test. You can also run the whole collection using Postman's Collection Runner.

## Demo endpoints

| Method | Path | What it teaches | Success |
| --- | --- | --- | --- |
| GET | `/` | Discover available routes | 200 |
| GET | `/health` | Check that the server is running | 200 |
| GET | `/users` | Read a list | 200 |
| GET | `/users?search=alex` | Filter using a query parameter | 200 |
| GET | `/users/1` | Read one item using a path parameter | 200 |
| POST | `/users` | Create an item; inspect the Location header | 201 |
| PUT | `/users/1` | Replace editable fields (both are required) | 200 |
| PATCH | `/users/1` | Change one field | 200 |
| DELETE | `/users/1` | Delete an item; response body is empty | 204 |
| POST | `/echo?lesson=http` | Inspect the JSON body, headers, and query sent | 200 |
| GET | `/protected` | Bearer authentication | 200 or 401 |
| POST | `/reset` | Restore the three original users | 200 |

For POST, PUT, and PATCH user requests, choose **Body → raw → JSON**. POST and PUT require both fields:

```json
{
  "name": "Taylor Smith",
  "email": "taylor@example.com"
}
```

For PATCH, try just `{ "name": "Taylor Updated" }`. IDs are assigned by the server. Unknown fields and invalid input return **400** with error details. Malformed JSON returns **400**, a non-JSON content type returns **415**, an unsupported method on a known route returns **405**, and a missing user or route returns **404**.

To try authentication, open **Authorization → Bearer Token** and enter `classroom-secret`. Omit it to see **401 Unauthorized**. This is a fixed teaching token, with no real login flow.

Try creating a user, retrieving it, updating it, deleting it, and retrieving it again to see the change from **200** to **404**. Use **POST /reset** before repeating a lesson. All changes live in memory and disappear when the server restarts.

The server binds to your computer only by default. To demo from other devices on your network, start with `HOST=0.0.0.0 npm start` and use your computer's LAN IP in Postman's `baseUrl`. This is a classroom demo with open CORS and unauthenticated CRUD/reset routes; keep it on a trusted network.

## Verify

```sh
npm test
```
