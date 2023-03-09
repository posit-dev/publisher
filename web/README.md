# Web Application

This application is built using [VueJS](https://vuejs.org).

## Getting Started

### Prerequisites

- [Just](https://just.systems)
- [Node.js](https://nodejs.org/)
- [Yarn](https://yarnpkg.com/getting-started/install)

## Installation

Execute `just install` from this directory to install all dependencies.

```
just install
```

## Development

Execute `just start` from this directory to start a development server using [Vite](https://vitejs.dev). By default, the application is available on port 5173. Go to `http://localhost:5173` to open the application in your browser.

```shell
just start
```

## Testing

### Unit Testing

Execute `just test` from this directory to execute the unit test suite. 

The unit test suite consists of JavaScript and Golang tests. Directions to run each language's test suite independently are below.

```
just test
```

#### Running JavaScript Unit Tests

Execute `yarn test` ton only execute JavaScript unit tests.

```
yarn test
```

#### Running Golang Unit Tests

Execute `go test` to only execute Golang unit tests.

```
go test
```

Note: Golang unit tests depend on a built distribution in the `./dist` directory. To rebuild the distribution, execute `just build --mode development`.