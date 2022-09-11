/**
 * Copyright 2019 GraphQL Foundation Contributors
 * originally from:
 * https://github.com/graphql/graphiql/tree/monaco-test/packages/monaco-graphql
 */

import * as monaco from "monaco-editor";

import { editor, KeyCode, KeyMod } from "monaco-editor";

import {
  GraphQLSchema,
  buildClientSchema,
  IntrospectionQuery,
  getIntrospectionQuery
} from "graphql";

import "whatwg-fetch";

import {
  onChangeQuery,
  setupQueryEditor,
  setupVariablesEditor
} from "./monaco-graphql-query";

import { loadBrowserConfig, GraphQLConfig } from "./graphql-config";

console.log(monaco.languages.CompletionItemKind);

// self.MonacoEnvironment = {
//   getWorkerUrl: function(moduleId, label) {
//     if (label === "json") {
//       return "/dist/json.worker.js";
//     }
//     return "/dist/editor.worker.js";
//   }
// };

const exampleQuery = `fragment SpeciesItem on Species {
  language
  name
  averageHeight
  averageLifespan
}

fragment StarshipItem on Starship {
  name
  maxAtmospheringSpeed
  length
  hyperdriveRating
}

fragment FilmWithSpecies on Film {
  speciesConnection(first: $speciesSkip) {
    totalCount
    edges {
      node {
          ...SpeciesItem
      }
    }
  }
}

fragment FilmWithShips on Film {
  starships: starshipConnection(first: $speciesSkip) {
    edges {
      node {
    ...StarshipItem
      }
      }
  }
}

query NamedQuery($filmSkip: Int!, $speciesSkip: Int!) {
  films: allFilms(first: $filmSkip) {
    edges {
      node {
        title
        ...FilmWithSpecies
        ...FilmWithShips
      }
    }
  }
}`;

const exampleVariables = `{ 
  "speciesSkip":5, 
  "filmSkip":2
} `;

class GraphQLIdeExample {
  url: string;
  config: GraphQLConfig;
  queryModel: editor.ITextModel;
  resultsModel: editor.ITextModel;
  variablesModel: editor.ITextModel;
  schema?: GraphQLSchema;
  queryEditor: editor.IStandaloneCodeEditor;
  resultsEditor: editor.IStandaloneCodeEditor;
  variablesEditor: editor.IStandaloneCodeEditor;
  introspectionJSON?: IntrospectionQuery;
  constructor(
    url: string = "https://swapi-graphql.netlify.com/.netlify/functions/index"
  ) {
    this.queryModel = editor.createModel(exampleQuery, "graphql");
    this.variablesModel = editor.createModel(exampleVariables, "json");
    this.resultsModel = editor.createModel("{}", "json");

    this.queryEditor = editor.create(
      document.getElementById("container-query") as HTMLElement,
      {
        model: this.queryModel
      }
    );

    this.variablesEditor = editor.create(
      document.getElementById("container-variables") as HTMLElement,
      {
        model: this.variablesModel
      }
    );
    this.resultsEditor = editor.create(
      document.getElementById("container-results") as HTMLElement,
      {
        model: this.resultsModel,
        wordWrap: "on"
      }
    );
    this.url = url;
    this.queryModel.onDidChangeContent(
      async (_event: editor.IModelContentChangedEvent) => {
        await onChangeQuery({
          model: this.queryModel,
          schema: this.schema as GraphQLSchema
        });
      }
    );
    this.variablesModel.onDidChangeContent(
      async (_event: editor.IModelContentChangedEvent) => {
        await onChangeQuery({
          model: this.variablesModel,
          schema: this.schema as GraphQLSchema
        });
      }
    );
    const runAction: editor.IActionDescriptor = {
      id: "ex-op",
      label: "Execute GraphQL Operation",
      keybindings: [KeyMod.CtrlCmd | KeyCode.Enter],
      run: async () => {
        await this.runOperation();
      }
    };
    this.queryEditor.addAction(runAction);
    this.variablesEditor.addAction(runAction);
    window.addEventListener("resize", this.onResize);
  }
  runOperation = async () => {
    const data = await fetch(this.url, {
      method: "POST",
      body: JSON.stringify({
        query: this.queryModel.getValue(),
        variables: this.variablesModel.getValue()
      }),
      headers: { "content-type": "application/json" }
    });
    const { data: result, errors } = await data.json();
    this.resultsModel.setValue(JSON.stringify(result || errors, null, 2));
  };
  onResize = () => {
    this.queryEditor.layout();
    this.variablesEditor.layout();
    this.resultsEditor.layout();
  };
  loadSchema = async () => {
    this.config = await loadBrowserConfig();
    console.log(this.config);
    let result;
    try {
      const introspectionResponse = await fetch(this.url, {
        method: "POST",
        body: JSON.stringify({
          query: getIntrospectionQuery()
        }),
        headers: { "content-type": "application/json" }
      });
      result = (await introspectionResponse.json()) as {
        data: IntrospectionQuery;
      };
    } catch (error) {
      console.error(error);
    } finally {
      this.introspectionJSON = result.data;
      this.schema = buildClientSchema(this.introspectionJSON);
      setupQueryEditor(this.schema, this.queryModel);
      setupVariablesEditor(this.schema, this.variablesModel, this.queryModel);
    }
  };
}

const queryEditorInstance = new GraphQLIdeExample();

(async () => await queryEditorInstance.loadSchema())();
