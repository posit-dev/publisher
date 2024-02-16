#  API Wrapper Library

A library to enable convenient access to the Publisher Client API and its
response types.

## Usage

```typescript
import { useApi } from 'src/api';

const api = useApi();

try {
  const response = await api.accounts.getAll();
} catch (err) {
  // handle the error
}
```

If you need to set the URL and or Port for the base API endpoint you can do so
using `setBaseUrl`. This changes the client so all requests will use the new
base URL. This will need to be done before any requests are made.

```typescript
api.setBaseUrl('http://localhost:9000/api');
```

## Organization

### `client.ts`

Contains the `PublishingClientApi` class which constructs the `AxiosInstance`,
passes it down to each of the resources for use, and gathers all of the
resources. This is the what we interact with.

### `/resources`

Each class in the `resources` folder has methods related to its endpoint. Each
method has a one-to-one relationship with the API endpoint on the server side.

Example: `/api/accounts` maps to the `resources/Accounts.ts` module and `GET
api/accounts` maps to the `api.accounts.getAll()` method.

### `/types`

Holds the types definitions for use in Resources to prevent Resources from
getting cluttered.

## Patterns

### Limited Exports

Rather than exporting the `AxiosInstance` or the `PublishingClientApi` class a
constant is exported to prevent more than one client from being created and any
non-resource-method usage of this library.

We can use the exported `api` constant to access an instance of
`PublishingClientApi`.

Or we can use the `useApi()` function which follows some of the syntax seen in
the [Composition API](https://vuejs.org/api/sfc-script-setup.html#useslots-useattrs)
and other Vue 3 libraries such as [Pinia](https://pinia.vuejs.org/).

### Return All Available Data

Each Resource method returns the full `AxiosResponse`. We can use a
[destructing assignment](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring_assignment)
to reduce boilerplate and ensure that we do not lose potentially-needed data.

```typescript
try {
  const { data } = await api.accounts.getAll();
} catch (err) {
  // handle the error
}
```
