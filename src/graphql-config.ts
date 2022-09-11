/* global BrowserFS */
import { loadConfig, GraphQLConfig } from "graphql-config";
import fs from "fs";


// @ts-ignore
BrowserFS.configure({ fs: "LocalStorage" }, e => {
  if (e) throw e;
  // @ts-ignore
  window.fs = require("fs");
});

const config = `schema: "https://localhost:8080"
extensions:
  graphiql:
    docExplorerOpen: false
`;
const loadBrowserConfig = () => {
  try {
    fs.writeFile("./graphql-config.yml", config, err => {
      if (err) console.error(err);
    });
    return loadConfig({
      filepath: "./graphql-config.yml",
      rootDir: "project",
      extensions: [
        () => ({
          name: "graphiql"
        })
      ]
    });
  } catch (err) {
    console.error(err);

    throw err;
  }
};

export { GraphQLConfig, loadBrowserConfig };
