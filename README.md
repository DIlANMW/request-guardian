# fetch-shield

[![npm version](https://img.shields.io/npm/v/fetch-shield)](https://www.npmjs.com/package/fetch-shield)
[![npm downloads](https://img.shields.io/npm/dm/fetch-shield)](https://www.npmjs.com/package/fetch-shield)
[![license](https://img.shields.io/npm/l/fetch-shield)](./LICENSE)

> Lightweight fetch/axios wrapper with automatic retries, exponential backoff, and rate-limit handling.

Every developer keeps rewriting the same retry logic. `fetch-shield` solves that once, cleanly, in TypeScript.

## Features

- 🔁 Auto-retry with exponential backoff
- 🚦 Rate limit (429) handling with `Retry-After` header parsing
- 📝 Structured logging of failed requests
- 🪶 Zero runtime dependencies (axios is optional)
- 🔷 Full TypeScript support with generics
- 📦 Dual CJS/ESM output

## Installation

```bash
npm install fetch-shield
# if using axios adapter:
npm install axios
```

## Usage

### fetch adapter

```ts
import { guardedFetch } from 'fetch-shield';

const response = await guardedFetch<{ id: number }>(
  'https://api.example.com/users/1',
  {
    maxRetries: 3,
    baseDelay: 300,
    onRetry: (info) => console.log(`Retrying... attempt ${info.attempt + 1}`),
  },
);

console.log(response.data); // typed as { id: number }
console.log(response.status); // 200
console.log(response.attempts); // number of attempts made
```

### axios adapter

```ts
import { guardedAxios } from 'fetch-shield';

const response = await guardedAxios<{ id: number }>(
  {
    method: 'GET',
    url: 'https://api.example.com/users/1',
  },
  {
    maxRetries: 3,
    baseDelay: 300,
  },
);

console.log(response.data);
```

### With logger

```ts
import { guardedFetch, defaultRetryLogger } from 'fetch-shield';

const response = await guardedFetch('https://api.example.com/data', {
  maxRetries: 3,
  onRetry: (info) =>
    defaultRetryLogger(info, {
      url: 'https://api.example.com/data',
      method: 'GET',
    }),
});
```

## Options

| Option             | Type       | Default                          | Description                                |
| ------------------ | ---------- | -------------------------------- | ------------------------------------------ |
| `maxRetries`       | `number`   | `3`                              | Max retry attempts after initial try       |
| `baseDelay`        | `number`   | `300`                            | Base delay in ms for backoff               |
| `maxDelay`         | `number`   | `10000`                          | Max delay cap in ms                        |
| `jitter`           | `boolean`  | `true`                           | Add random jitter to avoid thundering herd |
| `retryStatusCodes` | `number[]` | `[408, 429, 500, 502, 503, 504]` | Status codes that trigger a retry          |
| `onRetry`          | `function` | `undefined`                      | Called before each retry with attempt info |

## License

MIT
