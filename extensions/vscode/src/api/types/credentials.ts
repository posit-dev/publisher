export type Credential = {
  name: string;
  url: string;
  apiKey: string;
};

export type Credentials = Map<string, Credential>;
