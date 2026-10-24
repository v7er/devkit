import { describe, expect, it } from "vitest";
import {
  CurlParseError,
  DnsError,
  HeaderParseError,
  SubnetError,
  UrlParseError,
  WebSocketUrlError,
  buildDnsQueryUrl,
  buildUrl,
  calculateSubnet,
  describeSocketData,
  filterHttpStatuses,
  filterPorts,
  formatLogTime,
  generateCurlCode,
  generateMetaTags,
  normalizeDomain,
  parseCurl,
  parseDnsResponse,
  parseHeaders,
  parseQueryString,
  parseUrl,
  parseUserAgent,
  serializeQuery,
  tokenizeCurl,
  validateWebSocketUrl,
} from "./logic";

describe("http status reference", () => {
  it("searches code, name, and description", () => {
    expect(filterHttpStatuses("too many", null).map((status) => status.code)).toEqual([429]);
    expect(filterHttpStatuses("418", null).map((status) => status.code)).toEqual([418]);
    expect(filterHttpStatuses("permanent", "redirection").map((status) => status.code)).toContain(301);
  });

  it("filters by category and handles no matches", () => {
    expect(filterHttpStatuses("", "server").every((status) => status.code >= 500)).toBe(true);
    expect(filterHttpStatuses("zzz-no-match", null)).toEqual([]);
  });
});

describe("port reference", () => {
  it("searches services and port numbers", () => {
    expect(filterPorts("postgres", "all").map((entry) => entry.port)).toEqual([5432]);
    expect(filterPorts("5432", "all").map((entry) => entry.service)).toEqual(["postgresql"]);
    expect(filterPorts("443", "all").map((entry) => entry.service)).toEqual(
      expect.arrayContaining(["https", "http3"]),
    );
  });

  it("filters by protocol while keeping shared ports", () => {
    const udp = filterPorts("", "udp");
    expect(udp.some((entry) => entry.port === 53)).toBe(true);
    expect(udp.some((entry) => entry.port === 5432)).toBe(false);
    expect(filterPorts("", "tcp").every((entry) => entry.protocol !== "udp")).toBe(true);
  });
});

describe("tokenizeCurl", () => {
  it("handles quotes, escapes, and continuations", () => {
    const command = `curl -X POST 'https://example.com/a b' \\\n  -H "X-Test: \\"quoted\\"" -d "line\\nnext"`;
    expect(tokenizeCurl(command)).toEqual([
      "curl",
      "-X",
      "POST",
      "https://example.com/a b",
      "-H",
      'X-Test: "quoted"',
      "-d",
      "line\\nnext",
    ]);
  });

  it("keeps literal backslashes inside single quotes", () => {
    expect(tokenizeCurl("curl -d 'a\\nb'")).toEqual(["curl", "-d", "a\\nb"]);
  });

  it("rejects an unclosed quote", () => {
    expect(() => tokenizeCurl("curl -H 'nope")).toThrow(CurlParseError);
  });
});

describe("parseCurl", () => {
  const sample = `curl -X POST https://api.example.com/users \\
    -H 'Content-Type: application/json' \\
    -H "Authorization: Bearer token" \\
    -d '{"name":"Ada"}'`;

  it("parses a JSON POST request", () => {
    const parsed = parseCurl(sample);
    expect(parsed.method).toBe("POST");
    expect(parsed.url).toBe("https://api.example.com/users");
    expect(parsed.body).toBe('{"name":"Ada"}');
    expect(parsed.headers).toContainEqual({ name: "Content-Type", value: "application/json" });
    expect(parsed.form).toBeNull();
    expect(parsed.warnings).toEqual([]);
  });

  it("supports attached short flag values and default methods", () => {
    const parsed = parseCurl("curl -XPOST -H'X-A: 1' example.com/api");
    expect(parsed.method).toBe("POST");
    expect(parsed.url).toBe("http://example.com/api");
    expect(parsed.headers).toEqual([{ name: "X-A", value: "1" }]);
  });

  it("moves data into the query string with -G", () => {
    const parsed = parseCurl("curl -G https://example.com/search --data-urlencode 'q=hello world'");
    expect(parsed.method).toBe("GET");
    expect(parsed.body).toBeNull();
    expect(parsed.url).toBe("https://example.com/search?q=hello%20world");
  });

  it("adds auth, cookies, compression, and timeouts", () => {
    const parsed = parseCurl('curl -u user:pass -b "sid=abc" --compressed -m 5 https://example.com');
    expect(parsed.auth).toEqual({ username: "user", password: "pass" });
    expect(parsed.timeoutSeconds).toBe(5);
    expect(parsed.headers).toEqual(
      expect.arrayContaining([
        { name: "Cookie", value: "sid=abc" },
        { name: "Accept-Encoding", value: "gzip, deflate, br" },
      ]),
    );
    expect(generateCurlCode(parsed, "fetch")).toContain('"Authorization": "Basic dXNlcjpwYXNz"');
  });

  it("parses urlencoded forms and rejects file fields", () => {
    const parsed = parseCurl('curl -F "name=Ada" -F role=admin https://example.com/form');
    expect(parsed.method).toBe("POST");
    expect(parsed.form).toEqual([
      { name: "name", value: "Ada" },
      { name: "role", value: "admin" },
    ]);
    expect(() => parseCurl('curl -F "avatar=@photo.png" https://example.com')).toThrow(CurlParseError);
  });

  it("tracks HEAD and custom methods", () => {
    expect(parseCurl("curl -I https://example.com").method).toBe("HEAD");
    expect(parseCurl("curl -X DELETE https://example.com/1").method).toBe("DELETE");
  });

  it("warns when a GET request has a body", () => {
    const parsed = parseCurl("curl -X GET -d a=1 https://example.com");
    expect(parsed.method).toBe("GET");
    expect(parsed.body).toBeNull();
    expect(parsed.warnings.join(" ")).toContain("cannot carry a body");
  });

  it("rejects invalid input", () => {
    expect(() => parseCurl("")).toThrow(CurlParseError);
    expect(() => parseCurl("curl -H 'nope' https://example.com")).toThrow(CurlParseError);
    expect(() => parseCurl("curl -d a=1")).toThrow(/No URL/);
    expect(() => parseCurl("curl --frobnicate https://example.com")).toThrow(/Unsupported flag/);
    expect(() => parseCurl("curl -T file.txt https://example.com")).toThrow(CurlParseError);
    expect(() => parseCurl("curl ftp://example.com/file")).toThrow(/Only http/);
    expect(() => parseCurl("curl -m nope https://example.com")).toThrow(/positive number/);
  });
});

describe("generateCurlCode", () => {
  const parsed = parseCurl(
    'curl -X PUT https://example.com/items/1 -H "Content-Type: application/json" -d \'{"done":true}\'',
  );

  it("emits fetch", () => {
    const code = generateCurlCode(parsed, "fetch");
    expect(code).toContain('await fetch("https://example.com/items/1"');
    expect(code).toContain('method: "PUT"');
    expect(code).toContain('body: "{\\"done\\":true}"');
  });

  it("emits Python requests", () => {
    const code = generateCurlCode(parsed, "python");
    expect(code).toContain("import requests");
    expect(code).toContain('requests.request(');
    expect(code).toContain('data = "{\\"done\\":true}"');
  });

  it("emits Go net/http", () => {
    const code = generateCurlCode(parsed, "go");
    expect(code).toContain('"net/http"');
    expect(code).toContain('http.NewRequest("PUT", "https://example.com/items/1"');
    expect(code).toContain("strings.NewReader");
  });

  it("emits Node fetch", () => {
    const code = generateCurlCode(parsed, "node");
    expect(code).toContain("Node.js 18");
    expect(code).toContain("await response.text()");
  });
});

describe("calculateSubnet", () => {
  it("calculates a /24", () => {
    const result = calculateSubnet("192.168.1.10/24");
    expect(result).toMatchObject({
      prefix: 24,
      network: "192.168.1.0",
      broadcast: "192.168.1.255",
      mask: "255.255.255.0",
      wildcard: "0.0.0.255",
      firstUsable: "192.168.1.1",
      lastUsable: "192.168.1.254",
      usableCount: 254,
      totalAddresses: 256,
      hostBits: 8,
      scope: "Private (RFC 1918)",
    });
    expect(result.maskBinary).toBe("11111111.11111111.11111111.00000000");
    expect(result.networkBinary).toBe("11000000.10101000.00000001.00000000");
  });

  it("handles /31, /32, and /0", () => {
    const pair = calculateSubnet("10.0.0.0/31");
    expect(pair.usableCount).toBe(2);
    expect(pair.firstUsable).toBe("10.0.0.0");
    expect(pair.lastUsable).toBe("10.0.0.1");

    const single = calculateSubnet("10.0.0.7/32");
    expect(single.firstUsable).toBe("10.0.0.7");
    expect(single.usableCount).toBe(1);

    const all = calculateSubnet("0.0.0.0/0");
    expect(all.totalAddresses).toBe(4294967296);
    expect(all.broadcast).toBe("255.255.255.255");
    expect(all.scope).toBe("This network (reserved)");
  });

  it("labels special ranges", () => {
    expect(calculateSubnet("100.64.0.0/10").scope).toContain("Carrier-grade");
    expect(calculateSubnet("224.0.0.0/4").scope).toBe("Multicast");
    expect(calculateSubnet("8.8.8.0/24").scope).toBe("Public");
  });

  it("rejects invalid CIDR input", () => {
    expect(() => calculateSubnet("")).toThrow(SubnetError);
    expect(() => calculateSubnet("192.168.1.0")).toThrow(/prefix/);
    expect(() => calculateSubnet("192.168.1.0/33")).toThrow(/between 0 and 32/);
    expect(() => calculateSubnet("192.168.1.256/24")).toThrow(/greater than 255/);
    expect(() => calculateSubnet("192.168.1/24")).toThrow(/four octets/);
    expect(() => calculateSubnet("2001:db8::/32")).toThrow(/IPv6/);
    expect(() => calculateSubnet("192.168.1.0/x")).toThrow(/valid prefix/);
  });
});

describe("parseUserAgent", () => {
  it("detects Chrome on macOS", () => {
    const info = parseUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    );
    expect(info.browser).toEqual({ name: "Chrome", version: "126.0.0.0" });
    expect(info.engine).toEqual({ name: "Blink", version: "126.0.0.0" });
    expect(info.os).toEqual({ name: "macOS", version: "10.15.7" });
    expect(info.device.type).toBe("desktop");
  });

  it("detects iPhone Safari", () => {
    const info = parseUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    );
    expect(info.browser?.name).toBe("Safari");
    expect(info.engine?.name).toBe("WebKit");
    expect(info.os?.name).toBe("iOS");
    expect(info.os?.version).toBe("17.5");
    expect(info.device).toMatchObject({ type: "mobile", vendor: "Apple", model: "iPhone" });
  });

  it("detects Android tablets and phones", () => {
    const phone = parseUserAgent(
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
    );
    expect(phone.os).toEqual({ name: "Android", version: "14" });
    expect(phone.device).toMatchObject({ type: "mobile", vendor: "Google", model: "Pixel 8" });

    const tablet = parseUserAgent(
      "Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    );
    expect(tablet.device.type).toBe("tablet");
  });

  it("detects bots, Edge, and empty input", () => {
    const bot = parseUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)");
    expect(bot.bot).toBe("Googlebot");
    expect(bot.device.type).toBe("bot");

    const edge = parseUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0",
    );
    expect(edge.browser?.name).toBe("Microsoft Edge");
    expect(edge.os?.version).toBe("10 or 11");

    expect(parseUserAgent("").device.type).toBe("unknown");
    expect(parseUserAgent("something-odd").device.type).toBe("unknown");
  });
});

describe("URL parsing", () => {
  it("breaks down an absolute URL", () => {
    const parsed = parseUrl("https://user:secret@example.com:8443/a/b?x=1&x=2&q=hello+world#top");
    expect(parsed).toMatchObject({
      protocol: "https:",
      username: "user",
      password: "secret",
      host: "example.com:8443",
      hostname: "example.com",
      port: "8443",
      origin: "https://example.com:8443",
      pathname: "/a/b",
      hash: "#top",
      isRelative: false,
    });
    expect(parsed.query).toEqual([
      { key: "x", value: "1" },
      { key: "x", value: "2" },
      { key: "q", value: "hello world" },
    ]);
  });

  it("parses relative paths and protocol-relative URLs", () => {
    const relative = parseUrl("/search?q=devkit#results");
    expect(relative.isRelative).toBe(true);
    expect(relative.pathname).toBe("/search");
    expect(relative.query).toEqual([{ key: "q", value: "devkit" }]);

    const protocolRelative = parseUrl("//cdn.example.com/app.js");
    expect(protocolRelative.protocolRelative).toBe(true);
    expect(protocolRelative.host).toBe("cdn.example.com");
  });

  it("rejects empty and malformed URLs", () => {
    expect(() => parseUrl("")).toThrow(UrlParseError);
    expect(() => parseUrl("http://")).toThrow(UrlParseError);
  });

  it("decodes and serializes query strings", () => {
    expect(parseQueryString("?a=1&flag&b=two%20words")).toEqual([
      { key: "a", value: "1" },
      { key: "flag", value: "" },
      { key: "b", value: "two words" },
    ]);
    expect(serializeQuery([{ key: "q", value: "a b" }, { key: "tag", value: "x&y" }])).toBe(
      "q=a+b&tag=x%26y",
    );
  });

  it("builds absolute, relative, and protocol-relative URLs", () => {
    const absolute = parseUrl("https://example.com/path?a=1#h");
    expect(buildUrl(absolute, [{ key: "a", value: "2" }, { key: "q", value: "hello world" }])).toBe(
      "https://example.com/path?a=2&q=hello+world#h",
    );

    const relative = parseUrl("/search?q=old");
    expect(buildUrl(relative, [{ key: "q", value: "new" }])).toBe("/search?q=new");

    const protocolRelative = parseUrl("//example.com/a?x=1");
    expect(buildUrl(protocolRelative, [{ key: "x", value: "2" }])).toBe("//example.com/a?x=2");
  });
});

describe("parseHeaders", () => {
  it("parses a response with duplicates, cookies, and security headers", () => {
    const raw = [
      "HTTP/2 200 OK",
      "Content-Type: text/html; charset=utf-8",
      "Set-Cookie: sid=abc; Path=/; HttpOnly; SameSite=Lax",
      "Set-Cookie: theme=dark; Max-Age=3600",
      "Cache-Control: no-cache",
      "Cache-Control: no-store",
      "Content-Security-Policy: default-src 'self'",
      "",
      "<html>body ignored</html>",
    ].join("\r\n");

    const parsed = parseHeaders(raw);
    expect(parsed.isResponse).toBe(true);
    expect(parsed.protocol).toBe("HTTP/2");
    expect(parsed.statusCode).toBe(200);
    expect(parsed.statusText).toBe("OK");
    expect(parsed.headers).toHaveLength(6);
    expect(parsed.duplicates).toEqual([
      {
        name: "set-cookie",
        values: ["sid=abc; Path=/; HttpOnly; SameSite=Lax", "theme=dark; Max-Age=3600"],
      },
      { name: "cache-control", values: ["no-cache", "no-store"] },
    ]);
    expect(parsed.cookies[0]).toMatchObject({
      source: "set-cookie",
      name: "sid",
      value: "abc",
      attributes: [
        { name: "Path", value: "/" },
        { name: "HttpOnly", value: "" },
        { name: "SameSite", value: "Lax" },
      ],
    });
    expect(parsed.cookies).toHaveLength(2);
    expect(parsed.security.find((check) => check.name === "content-security-policy")?.present).toBe(true);
    expect(parsed.security.find((check) => check.name === "strict-transport-security")?.present).toBe(false);
    expect(parsed.bodyIgnored).toBe(true);
    expect(parsed.byteSize).toBeGreaterThan(0);
  });

  it("parses request lines and splits Cookie pairs", () => {
    const parsed = parseHeaders(
      ["GET /api/items?page=2 HTTP/1.1", "Host: example.com", "Cookie: a=1; b=two", "Accept: */*"].join("\n"),
    );
    expect(parsed.isResponse).toBe(false);
    expect(parsed.protocol).toBe("HTTP/1.1");
    expect(parsed.statusCode).toBeNull();
    expect(parsed.cookies.map((cookie) => `${cookie.name}=${cookie.value}`)).toEqual(["a=1", "b=two"]);
    expect(parsed.headers).toHaveLength(3);
  });

  it("supports header-only blocks and folded values", () => {
    const parsed = parseHeaders("X-Long: first\n  second\nContent-Type: text/plain");
    expect(parsed.startLine).toBeNull();
    expect(parsed.headers[0]).toEqual({ name: "X-Long", value: "first second", line: 1 });
  });

  it("rejects malformed headers", () => {
    expect(() => parseHeaders("")).toThrow(HeaderParseError);
    expect(() => parseHeaders("Not a header line")).toThrow(/first line/);
    expect(() => parseHeaders("X-Test: ok\nbroken line")).toThrow(/not a "Name: value"/);
    expect(() => parseHeaders("X-Test : ok")).toThrow(/whitespace/);
    expect(() => parseHeaders("Bad Header: ok")).toThrow(/valid header name/);
    expect(() => parseHeaders("X-Test: ok\n  folded")).not.toThrow();
  });
});

describe("generateMetaTags", () => {
  const empty = {
    title: "",
    description: "",
    canonical: "",
    robots: "",
    ogTitle: "",
    ogDescription: "",
    ogImage: "",
    ogUrl: "",
    ogType: "",
    ogSiteName: "",
    twitterCard: "",
    twitterSite: "",
    twitterCreator: "",
    twitterTitle: "",
    twitterDescription: "",
    twitterImage: "",
    themeColor: "",
  };

  it("escapes HTML and builds the expected tags", () => {
    const { html } = generateMetaTags({
      ...empty,
      title: 'Tom & Jerry <"cartoons">',
      description: "A <b>great</b> show",
      canonical: "https://example.com/shows/tom-jerry",
      robots: "index, follow",
      ogTitle: "Tom & Jerry",
      ogType: "article",
      ogSiteName: "Example",
      twitterCard: "summary_large_image",
      twitterSite: "@example",
      themeColor: "#0f172a",
    });
    expect(html).toContain("<title>Tom &amp; Jerry &lt;&quot;cartoons&quot;&gt;</title>");
    expect(html).toContain('content="A &lt;b&gt;great&lt;/b&gt; show"');
    expect(html).toContain('<link rel="canonical" href="https://example.com/shows/tom-jerry">');
    expect(html).toContain('<meta property="og:type" content="article">');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
    expect(html).toContain('<meta name="theme-color" content="#0f172a">');
    expect(html).not.toContain("og:image");
  });

  it("omits empty fields and reports missing basics", () => {
    const output = generateMetaTags(empty);
    expect(output.html).toBe("");
    expect(output.hints.map((hint) => hint.field)).toEqual(["Title", "Description"]);
  });

  it("warns about lengths and relative URLs", () => {
    const output = generateMetaTags({
      ...empty,
      title: "x".repeat(61),
      description: "short",
      canonical: "/relative",
      ogUrl: "example.com",
      ogImage: "/share.png",
      ogDescription: "y".repeat(201),
      twitterDescription: "z".repeat(201),
      twitterImage: "/card.png",
    });
    const fields = output.hints.map((hint) => hint.field);
    expect(fields).toContain("Title");
    expect(fields).toContain("Description");
    expect(fields).toContain("Canonical");
    expect(fields).toContain("Open Graph URL");
    expect(fields).toContain("Open Graph image");
    expect(fields).toContain("Open Graph description");
    expect(fields).toContain("Twitter description");
    expect(fields).toContain("Twitter image");
  });
});

describe("DNS helpers", () => {
  it("normalizes hostnames", () => {
    expect(normalizeDomain("  Example.COM ")).toBe("example.com");
    expect(normalizeDomain("_dmarc.example.com")).toBe("_dmarc.example.com");
    expect(normalizeDomain("münich.de")).toBe("xn--mnich-kva.de");
  });

  it("rejects URLs, paths, ports, and spaces", () => {
    expect(() => normalizeDomain("")).toThrow(DnsError);
    expect(() => normalizeDomain("https://example.com")).toThrow(/hostname only/);
    expect(() => normalizeDomain("example.com/path")).toThrow(/hostname only/);
    expect(() => normalizeDomain("example.com:443")).toThrow(/hostname only/);
    expect(() => normalizeDomain("exa mple.com")).toThrow(/spaces/);
  });

  it("builds the Cloudflare query URL", () => {
    expect(buildDnsQueryUrl("example.com", "AAAA")).toBe(
      "https://cloudflare-dns.com/dns-query?name=example.com&type=AAAA",
    );
  });

  it("parses records and maps numeric types", () => {
    const result = parseDnsResponse({
      Status: 0,
      Truncated: false,
      Answer: [
        { name: "example.com", type: 1, TTL: 300, data: "93.184.216.34" },
        { name: "example.com", type: 5, TTL: 3600, data: "edge.example.net" },
      ],
    });
    expect(result.records).toEqual([
      { name: "example.com", type: "A", ttl: 300, data: "93.184.216.34" },
      { name: "example.com", type: "CNAME", ttl: 3600, data: "edge.example.net" },
    ]);
    expect(result.statusMessage).toBe("");
  });

  it("reports NXDOMAIN and malformed responses", () => {
    const missing = parseDnsResponse({ Status: 3 });
    expect(missing.records).toEqual([]);
    expect(missing.statusMessage).toContain("does not exist");

    expect(() => parseDnsResponse(null)).toThrow(DnsError);
    expect(() => parseDnsResponse({ Answer: [] })).toThrow(/status code/);
    expect(() => parseDnsResponse({ Status: 0, Answer: "nope" })).toThrow(/answer section/);
  });
});

describe("WebSocket helpers", () => {
  it("validates ws and wss URLs", () => {
    expect(validateWebSocketUrl("ws://localhost:8080/socket")).toBe("ws://localhost:8080/socket");
    expect(validateWebSocketUrl(" wss://example.com/socket ")).toBe("wss://example.com/socket");
    expect(() => validateWebSocketUrl("")).toThrow(WebSocketUrlError);
    expect(() => validateWebSocketUrl("https://example.com")).toThrow(/ws:\/\//);
    expect(() => validateWebSocketUrl("not a url")).toThrow(WebSocketUrlError);
  });

  it("formats timestamps and socket payloads", () => {
    expect(formatLogTime(new Date(2026, 0, 2, 3, 4, 5, 6))).toBe("03:04:05.006");
    expect(describeSocketData("hello")).toBe("hello");
    expect(describeSocketData(new ArrayBuffer(8))).toBe("[binary frame, 8 bytes]");
    expect(describeSocketData(new Blob(["abc"]))).toBe("[binary frame, 3 bytes]");
  });
});
