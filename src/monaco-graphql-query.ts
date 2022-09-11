import {
  editor,
  languages,
  Position,
  CancellationToken,
  MarkerSeverity
} from "monaco-editor/esm/vs/editor/editor.api";

import { GraphQLSchema } from "graphql";

import {
  getHoverInformation,
  getDiagnostics,
  getAutocompleteSuggestions
} from "graphql-language-service-interface";

import { Position as GraphQLPosition } from "graphql-language-service-utils";

/**
 *  Copyright (c) 2019 GraphQL Contributors.
 *
 *  This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */
export function setupQueryEditor(
  schema: GraphQLSchema,
  model: editor.ITextModel
) {
  languages.registerHoverProvider("graphql", {
    provideHover(
      model: editor.ITextModel,
      position: Position,
      token: CancellationToken
    ) {
      return provideHoverInfo({
        position,
        model,
        schema,
        token,
        queryText: model.getValue()
      });
    }
  });
  languages.registerCompletionItemProvider("graphql", {
    async provideCompletionItems(model: editor.ITextModel, position: Position) {
      return provideCompletionItems({
        position,
        model,
        schema,
        queryText: model.getValue()
      });
    }
  });
  languages.registerDocumentFormattingEditProvider("graphql", {
    async provideDocumentFormattingEdits(model, options, token) {
      const prettier = await import("prettier/standalone");
      const parserGraphql = await import("prettier/parser-graphql");
      const formatted = await prettier.format(model.getValue(), {
        parser: "graphql",
        plugins: [parserGraphql]
      });
      return [
        {
          range: model.getFullModelRange(),
          text: formatted
        }
      ];
    }
  });
  diagnoseQueryValue({ schema, model });
}

export function setupVariablesEditor(
  schema: GraphQLSchema,
  model: editor.ITextModel,
  queryModel: editor.ITextModel
) {
  languages.registerHoverProvider("json", {
    provideHover(
      model: editor.ITextModel,
      position: Position,
      token: CancellationToken
    ) {
      return provideHoverInfo({
        position,
        model,
        schema,
        token,
        queryText: queryModel.getValue()
      });
    }
  });
  languages.registerCompletionItemProvider("json", {
    async provideCompletionItems(model: editor.ITextModel, position: Position) {
      return provideCompletionItems({
        position,
        model,
        schema,
        queryText: queryModel.getValue()
      });
    }
  });
}

export function onChangeQuery({
  model,
  schema
}: {
  model: editor.ITextModel;
  schema: GraphQLSchema;
}) {
  const modelValue = model.getValue();
  if (modelValue && modelValue.length > 2) {
    return diagnoseQueryValue({ model, schema });
  }
}

export type ProviderItemInput = {
  position: Position;
  model: editor.ITextModel;
  schema: GraphQLSchema;
  token?: CancellationToken;
  queryText: string;
};

export async function provideHoverInfo({
  position,
  model,
  schema
}: ProviderItemInput): Promise<languages.Hover> {
  const graphQLPosition = new GraphQLPosition(
    position.lineNumber - 1,
    position.column
  );
  graphQLPosition.setCharacter(position.column);
  graphQLPosition.line = position.lineNumber - 1;
  const hoverInfo = getHoverInformation(
    schema,
    model.getValue(),
    graphQLPosition
  );
  if (!hoverInfo) {
    return {
      contents: []
    };
  }
  return {
    contents: [{ value: `${hoverInfo}` }]
  };
}

export async function provideCompletionItems({
  position,
  queryText,
  model,
  schema
}: ProviderItemInput): Promise<
  languages.ProviderResult<languages.CompletionList>
> {
  const graphQLPosition = new GraphQLPosition(
    position.lineNumber - 1,
    position.column - 1
  );
  graphQLPosition.setCharacter(position.column - 1);
  graphQLPosition.line = position.lineNumber - 1;
  const suggestions = await getAutocompleteSuggestions(
    schema,
    model.getValue(),
    graphQLPosition
  );
  // @ts-ignore wants range
  return {
    // TODO: possibly return different kinds of completion items?
    // TODO: (optionally?) show all completion items at first?
    suggestions: suggestions.map(s => ({
      label: s.label,
      kind: s.kind,
      detail: s.detail,
      documentation: s.documentation,
      insertText: s.label
    }))
  };
}

export const diagnoseQueryValue = async ({
  model,
  schema
}: {
  model: editor.ITextModel; // query or schema
  schema: GraphQLSchema;
}): Promise<{
  valid: boolean;
  formattedDiagnostics: editor.IMarkerData[];
  diagnostics: any[];
}> => {
  let valid = false;
  const diagnostics = await getDiagnostics(model.getValue(), schema);
  const formattedDiagnostics: editor.IMarkerData[] = diagnostics.map(d => ({
    startLineNumber: d.range.start.line + 1,
    endLineNumber: d.range.end.line + 1,
    startColumn: d.range.start.character + 1,
    endColumn: d.range.end.character + 1,
    message: d.message,
    severity: MarkerSeverity.Error
  }));
  if (diagnostics.length < 1) {
    valid = true;
  }
  editor.setModelMarkers(model, "linter", formattedDiagnostics);

  return {
    valid,
    formattedDiagnostics,
    diagnostics
  };
};
