- server-type from URL checks suffix, but can we actually trust that the url has been normalized for this to make sense?
  - test with a snowflake url with suffix
- server type Connect, auth type API are hard-coded throughout

- UI detects snowflake URL and skips API Token
- UI asks for connection name
- server connection test works with snowflake
- deployment works with snowflake
