// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { AxiosRequestConfig } from 'axios';

declare module 'axios' {
    interface AxiosRequestConfig {
        ignoreCamelCase?: string[]
    }
}
