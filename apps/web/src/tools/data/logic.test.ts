import { describe, expect, it } from "vitest";
import {
  csvToJson,
  evaluateJsonPath,
  formatGraphql,
  formatSql,
  formatXml,
  jsonToCsv,
  jsonToJsonSchema,
  jsonToTypescript,
  jsonToXml,
  jsonToYaml,
  parseCsv,
  xmlToJson,
  yamlToJson,
} from "./logic";

describe("yamlToJson", () => {
  it("converts nested YAML values", () => {
    const output = yamlToJson("name: Ada\ntags:\n  - math\n  - code\nactive: true");
    expect(JSON.parse(output)).toEqual({ name: "Ada", tags: ["math", "code"], active: true });
  });

  it("converts a multi-document stream into a JSON array", () => {
    const output = yamlToJson("a: 1\n---\nb: 2\n");
    expect(JSON.parse(output)).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it("reports YAML syntax errors with a location", () => {
    expect(() => yamlToJson("name: [")).toThrow(/Line 1/);
  });

  it("rejects empty input", () => {
    expect(() => yamlToJson("   ")).toThrow("Input is empty");
  });
});

describe("jsonToYaml", () => {
  it("writes YAML from JSON", () => {
    const output = jsonToYaml('{"name":"Ada","tags":["math","code"]}');
    expect(output).toContain("name: Ada");
    expect(output).toContain("- math");
  });

  it("writes one document per array item when requested", () => {
    const output = jsonToYaml('[{"a":1},{"b":2}]', { multiDocument: true });
    expect(output).toContain("---");
    expect(output.match(/---/g)).toHaveLength(1);
  });

  it("rejects invalid JSON", () => {
    expect(() => jsonToYaml("{oops")).toThrow();
  });
});

describe("parseCsv", () => {
  it("handles quoted commas", () => {
    expect(parseCsv('name,note\nAda,"hello, world"')).toEqual([
      ["name", "note"],
      ["Ada", "hello, world"],
    ]);
  });

  it("handles escaped quotes and embedded newlines", () => {
    expect(parseCsv('a,"line 1\nline 2","say ""hi"""')).toEqual([
      ["a", "line 1\nline 2", 'say "hi"'],
    ]);
  });

  it("honors a custom delimiter", () => {
    expect(parseCsv("a;b\n1;2", ";")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("skips blank lines", () => {
    expect(parseCsv("a,b\n\n1,2\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("rejects an unclosed quoted field", () => {
    expect(() => parseCsv('a,"unclosed')).toThrow(/not closed/);
  });

  it("rejects a quote inside an unquoted field", () => {
    expect(() => parseCsv('a,b"c')).toThrow(/Quote inside/);
  });
});

describe("csvToJson", () => {
  it("uses the first row as object keys", () => {
    expect(csvToJson('name,note\nAda,"hello, world"', { hasHeader: true })).toEqual([
      { name: "Ada", note: "hello, world" },
    ]);
  });

  it("returns arrays when the header is off", () => {
    expect(csvToJson("a,b\n1,2", { hasHeader: false })).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("makes duplicate and blank headers unique", () => {
    expect(csvToJson("id,id,\n1,2,3", { hasHeader: true })).toEqual([
      { id: "1", id_2: "2", column_3: "3" },
    ]);
  });

  it("rejects empty input", () => {
    expect(() => csvToJson("", { hasHeader: true })).toThrow("Input is empty");
  });
});

describe("jsonToCsv", () => {
  it("quotes fields containing delimiters and writes headers", () => {
    const output = jsonToCsv('[{"name":"Ada","note":"x,y"},{"name":"Bob"}]', {
      includeHeader: true,
    });
    expect(output).toBe('name,note\nAda,"x,y"\nBob,');
  });

  it("supports a semicolon delimiter", () => {
    const output = jsonToCsv('[{"a":"x;y","b":2}]', {
      delimiter: ";",
      includeHeader: true,
    });
    expect(output).toBe('a;b\n"x;y";2');
  });

  it("stringifies nested values as JSON", () => {
    const output = jsonToCsv('[{"meta":{"ok":true}}]', { includeHeader: true });
    expect(output).toBe('meta\n"{""ok"":true}"');
  });

  it("writes array rows with generated headers", () => {
    const output = jsonToCsv("[[1,2],[3]]", { includeHeader: true });
    expect(output).toBe("column_1,column_2\n1,2\n3,");
  });

  it("rejects mixed array shapes", () => {
    expect(() => jsonToCsv('[{"a":1},2]')).toThrow(/mixes/);
  });

  it("rejects invalid JSON", () => {
    expect(() => jsonToCsv("{")).toThrow();
  });
});

describe("jsonToTypescript", () => {
  it("infers an interface for an object sample", () => {
    const output = jsonToTypescript(
      '{"name":"Ada","age":36,"active":true,"tags":["math"],"meta":null}',
    );
    expect(output).toContain("export interface Root {");
    expect(output).toContain("name: string;");
    expect(output).toContain("age: number;");
    expect(output).toContain("active: boolean;");
    expect(output).toContain("tags: Array<string>;");
    expect(output).toContain("meta: null;");
  });

  it("merges array items and marks missing fields optional", () => {
    const output = jsonToTypescript('[{"id":1,"name":"Ada"},{"id":2,"email":"a@b.c"}]');
    expect(output).toContain("export type Root = Array<RootItem>;");
    expect(output).toContain("id: number;");
    expect(output).toContain("name?: string;");
    expect(output).toContain("email?: string;");
  });

  it("creates nested interfaces and applies readonly", () => {
    const output = jsonToTypescript('{"user":{"id":1},"role":"admin"}', {
      readonly: true,
      rootName: "account",
    });
    expect(output).toContain("export interface Account {");
    expect(output).toContain("readonly user: User;");
    expect(output).toContain("export interface User {");
    expect(output).toContain("readonly id: number;");
  });

  it("quotes property names that are not identifiers", () => {
    const output = jsonToTypescript('{"first-name":"Ada"}');
    expect(output).toContain('"first-name": string;');
  });

  it("handles empty objects and arrays", () => {
    expect(jsonToTypescript("{}")).toContain("Record<string, unknown>");
    expect(jsonToTypescript("[]")).toContain("Array<unknown>");
  });

  it("rejects invalid JSON", () => {
    expect(() => jsonToTypescript("{nope")).toThrow();
  });
});

describe("evaluateJsonPath", () => {
  const source = JSON.stringify({
    store: {
      book: [
        { title: "A", price: 8 },
        { title: "B", price: 12 },
      ],
    },
  });

  it("returns matching values with paths", () => {
    const matches = evaluateJsonPath(source, "$..book[?(@.price < 10)]");
    expect(matches).toHaveLength(1);
    expect(matches[0]?.value).toEqual({ title: "A", price: 8 });
    expect(matches[0]?.path).toContain("book");
  });

  it("returns every match for a wildcard", () => {
    const matches = evaluateJsonPath(source, "$.store.book[*].title");
    expect(matches.map((match) => match.value)).toEqual(["A", "B"]);
  });

  it("rejects an empty expression", () => {
    expect(() => evaluateJsonPath(source, "  ")).toThrow(/Enter a JSONPath/);
  });

  it("rejects an invalid expression", () => {
    expect(() => evaluateJsonPath(source, "$[?(@.price == )]")).toThrow(/Invalid JSONPath/);
  });

  it("rejects invalid JSON", () => {
    expect(() => evaluateJsonPath("{", "$.a")).toThrow();
  });
});

describe("formatXml", () => {
  it("pretty-prints elements and self-closing tags", () => {
    expect(formatXml("<root><a>1</a><b/></root>").output).toBe(
      "<root>\n  <a>1</a>\n  <b/>\n</root>\n",
    );
  });

  it("keeps mixed content inline", () => {
    expect(formatXml("<p>Hello <b>world</b>!</p>").output).toBe(
      "<p>Hello <b>world</b>!</p>\n",
    );
  });

  it("reports element and attribute counts", () => {
    const result = formatXml('<root id="1"><child name="x"/></root>', { indent: 4 });
    expect(result.root).toBe("root");
    expect(result.elements).toBe(2);
    expect(result.attributes).toBe(2);
    expect(result.output).toContain('    <child name="x"/>');
  });

  it("preserves comments and the XML declaration", () => {
    const output = formatXml('<?xml version="1.0"?><root><!-- note --><a/></root>').output;
    expect(output).toContain('<?xml version="1.0"?>');
    expect(output).toContain("<!-- note -->");
  });

  it("reports malformed XML", () => {
    expect(() => formatXml("<root><a></root>")).toThrow();
  });

  it("rejects empty input", () => {
    expect(() => formatXml("")).toThrow("Input is empty");
  });
});

describe("xmlToJson", () => {
  it("keeps attributes, text, and repeated elements", () => {
    const value = xmlToJson(
      '<root id="1"><name>Ada</name><tag>a</tag><tag>b</tag><empty/></root>',
    );
    expect(value).toEqual({
      root: {
        "@id": "1",
        name: "Ada",
        tag: ["a", "b"],
        empty: "",
      },
    });
  });

  it("can omit attributes", () => {
    expect(xmlToJson('<root id="1">hello</root>', { attributes: false })).toEqual({
      root: "hello",
    });
  });

  it("can coerce scalar types", () => {
    expect(xmlToJson("<root><count>42</count><ok>true</ok></root>", { parseTypes: true })).toEqual({
      root: { count: 42, ok: true },
    });
  });

  it("reports malformed XML", () => {
    expect(() => xmlToJson("<root>")).toThrow();
  });
});

describe("jsonToXml", () => {
  it("uses a single top-level key as the root element", () => {
    expect(jsonToXml('{"root":{"a":"1"}}')).toBe("<root>\n  <a>1</a>\n</root>\n");
  });

  it("writes attributes and repeated elements", () => {
    const output = jsonToXml('{"root":{"@id":"1","tag":["a","b"]}}');
    expect(output).toContain('<root id="1">');
    expect(output).toContain("<tag>a</tag>");
    expect(output).toContain("<tag>b</tag>");
  });

  it("supports text and empty elements", () => {
    expect(jsonToXml('{"root":{"#text":"hello"}}')).toBe("<root>hello</root>\n");
    expect(jsonToXml('{"root":{"empty":null}}')).toBe("<root>\n  <empty/>\n</root>\n");
  });

  it("round-trips a simple document", () => {
    const source = '<root id="1"><name>Ada</name><tag>a</tag><tag>b</tag></root>';
    const json = xmlToJson(source);
    const output = jsonToXml(JSON.stringify(json));
    expect(output).toContain('<root id="1">');
    expect(output).toContain("<name>Ada</name>");
    expect(output).toContain("<tag>a</tag>");
    expect(output).toContain("<tag>b</tag>");
  });

  it("wraps object keys when requested", () => {
    expect(jsonToXml('{"a":1}', { useRootKey: false, rootName: "doc" })).toBe(
      "<doc>\n  <a>1</a>\n</doc>\n",
    );
  });

  it("rejects invalid element names", () => {
    expect(() => jsonToXml('{"bad name":{"a":1}}')).toThrow(/not a valid XML element name/);
  });

  it("wraps multi-key objects in the requested root", () => {
    expect(jsonToXml('{"a":1,"b":2}', { rootName: "root" })).toBe(
      "<root>\n  <a>1</a>\n  <b>2</b>\n</root>\n",
    );
  });
});

describe("jsonToJsonSchema", () => {
  it("infers types and required fields", () => {
    const schema = JSON.parse(
      jsonToJsonSchema(
        '{"name":"Ada","age":36,"score":9.5,"active":true,"tags":["a","b"],"meta":null}',
        { title: "Person" },
      ),
    );
    expect(schema.$schema).toBe("http://json-schema.org/draft-07/schema#");
    expect(schema.title).toBe("Person");
    expect(schema.type).toBe("object");
    expect(schema.required).toEqual(["name", "age", "score", "active", "tags", "meta"]);
    expect(schema.properties.age.type).toBe("integer");
    expect(schema.properties.score.type).toBe("number");
    expect(schema.properties.meta.type).toBe("null");
    expect(schema.properties.tags).toEqual({ type: "array", items: { type: "string" } });
  });

  it("requires only fields present in every array item", () => {
    const schema = JSON.parse(jsonToJsonSchema('[{"id":1,"name":"Ada"},{"id":2}]'));
    expect(schema.items.type).toBe("object");
    expect(schema.items.required).toEqual(["id"]);
    expect(schema.items.properties.name.type).toBe("string");
  });

  it("can disallow additional properties and omit required", () => {
    const schema = JSON.parse(
      jsonToJsonSchema('{"a":1}', { required: false, additionalProperties: false }),
    );
    expect(schema.required).toBeUndefined();
    expect(schema.additionalProperties).toBe(false);
  });

  it("infers nullable and mixed primitive arrays", () => {
    const schema = JSON.parse(jsonToJsonSchema('{"values":[1,null,"x"]}'));
    expect(schema.properties.values.items.type).toEqual(["integer", "null", "string"]);
  });

  it("rejects invalid JSON", () => {
    expect(() => jsonToJsonSchema("{")).toThrow();
  });
});

describe("formatSql", () => {
  it("formats keywords in upper case", () => {
    const output = formatSql("select id,name from users where id=1", {
      dialect: "postgresql",
      keywordCase: "upper",
    });
    expect(output).toContain("SELECT");
    expect(output).toContain("FROM");
    expect(output).toContain("WHERE");
  });

  it("formats keywords in lower case", () => {
    const output = formatSql("SELECT ID FROM USERS", {
      dialect: "sql",
      keywordCase: "lower",
    });
    expect(output).toContain("select");
    expect(output).not.toContain("SELECT");
  });

  it("uses tabs when requested", () => {
    const output = formatSql("select * from (select 1) as t", {
      keywordCase: "upper",
      indent: "\t",
    });
    expect(output).toContain("\t");
  });

  it("rejects empty input", () => {
    expect(() => formatSql("  ")).toThrow("Input is empty");
  });
});

describe("formatGraphql", () => {
  it("prints an operation", () => {
    const result = formatGraphql("query GetUser{user(id:1){name email}}");
    expect(result.definitions).toBe(1);
    expect(result.kinds).toEqual(["operation"]);
    expect(result.output).toContain("query GetUser {");
    expect(result.output).toContain("user(id: 1)");
    expect(result.output).toContain("email");
  });

  it("prints a schema definition", () => {
    const result = formatGraphql("type User { id: ID! name: String }");
    expect(result.kinds).toEqual(["object type"]);
    expect(result.output).toContain("type User {");
    expect(result.output).toContain("id: ID!");
  });

  it("reports syntax errors with a location", () => {
    try {
      formatGraphql("query {");
      throw new Error("expected a parse error");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toMatch(/Line 1, column/);
    }
  });

  it("rejects empty input", () => {
    expect(() => formatGraphql(" ")).toThrow("Input is empty");
  });
});
