export type HttpStatusCategory = "informational" | "success" | "redirection" | "client" | "server";

export interface HttpStatus {
  code: number;
  name: string;
  category: HttpStatusCategory;
  description: string;
}

export const HTTP_STATUSES: HttpStatus[] = [
  // 1xx
  { code: 100, name: "Continue", category: "informational", description: "The server received the request headers and the client should send the body." },
  { code: 101, name: "Switching Protocols", category: "informational", description: "The server is switching protocols as requested by the Upgrade header." },
  { code: 102, name: "Processing", category: "informational", description: "The server received the request and is still working; no response is ready yet." },
  { code: 103, name: "Early Hints", category: "informational", description: "Preliminary headers let the client start preloading resources before the final response." },
  // 2xx
  { code: 200, name: "OK", category: "success", description: "The request succeeded and the response body contains the result." },
  { code: 201, name: "Created", category: "success", description: "The request succeeded and a new resource was created, usually with a Location header." },
  { code: 202, name: "Accepted", category: "success", description: "The request was accepted for processing, but processing is not finished." },
  { code: 203, name: "Non-Authoritative Information", category: "success", description: "The response came from a transforming proxy and is not the origin server's exact payload." },
  { code: 204, name: "No Content", category: "success", description: "The request succeeded and there is no body to return." },
  { code: 205, name: "Reset Content", category: "success", description: "The client should reset the document view that produced the request." },
  { code: 206, name: "Partial Content", category: "success", description: "Only part of the resource is returned, as requested with a Range header." },
  { code: 207, name: "Multi-Status", category: "success", description: "The body contains status information for multiple independent operations (WebDAV)." },
  { code: 208, name: "Already Reported", category: "success", description: "Members of a WebDAV binding were already reported earlier in the response." },
  { code: 226, name: "IM Used", category: "success", description: "The server fulfilled a request using instance manipulations (HTTP delta encoding)." },
  // 3xx
  { code: 300, name: "Multiple Choices", category: "redirection", description: "The target has several representations and the client may choose one." },
  { code: 301, name: "Moved Permanently", category: "redirection", description: "The resource moved permanently; clients should update bookmarks to the new URL." },
  { code: 302, name: "Found", category: "redirection", description: "The resource is temporarily at another URL; the method may change to GET." },
  { code: 303, name: "See Other", category: "redirection", description: "The client should fetch a different URL, usually with GET after a form submission." },
  { code: 304, name: "Not Modified", category: "redirection", description: "The cached copy is still valid; no body is transferred." },
  { code: 305, name: "Use Proxy", category: "redirection", description: "The resource must be accessed through the proxy in the Location header. Deprecated." },
  { code: 307, name: "Temporary Redirect", category: "redirection", description: "The resource is temporarily elsewhere and the request method must be preserved." },
  { code: 308, name: "Permanent Redirect", category: "redirection", description: "The resource moved permanently and the request method must be preserved." },
  // 4xx
  { code: 400, name: "Bad Request", category: "client", description: "The server cannot process the request because the syntax or parameters are invalid." },
  { code: 401, name: "Unauthorized", category: "client", description: "Authentication is required or the supplied credentials are invalid." },
  { code: 402, name: "Payment Required", category: "client", description: "Reserved for future payment schemes; rarely used outside paid APIs." },
  { code: 403, name: "Forbidden", category: "client", description: "The server understood the request but refuses to authorize it." },
  { code: 404, name: "Not Found", category: "client", description: "No resource matches the requested URL." },
  { code: 405, name: "Method Not Allowed", category: "client", description: "The URL exists but does not support the request method; see the Allow header." },
  { code: 406, name: "Not Acceptable", category: "client", description: "The server cannot produce a representation matching the Accept headers." },
  { code: 407, name: "Proxy Authentication Required", category: "client", description: "The client must authenticate with the proxy before the request is forwarded." },
  { code: 408, name: "Request Timeout", category: "client", description: "The server timed out waiting for the complete request." },
  { code: 409, name: "Conflict", category: "client", description: "The request conflicts with the current state of the resource, such as a duplicate create." },
  { code: 410, name: "Gone", category: "client", description: "The resource existed but has been permanently removed." },
  { code: 411, name: "Length Required", category: "client", description: "The server requires a Content-Length header for this request." },
  { code: 412, name: "Precondition Failed", category: "client", description: "A conditional header such as If-Match did not match the resource state." },
  { code: 413, name: "Content Too Large", category: "client", description: "The request body exceeds the limit the server accepts." },
  { code: 414, name: "URI Too Long", category: "client", description: "The requested URL is longer than the server is willing to process." },
  { code: 415, name: "Unsupported Media Type", category: "client", description: "The request body format is not supported by the target resource." },
  { code: 416, name: "Range Not Satisfiable", category: "client", description: "The requested byte range cannot be served; check the Content-Range response." },
  { code: 417, name: "Expectation Failed", category: "client", description: "The server cannot meet the expectations in the Expect header." },
  { code: 418, name: "I'm a Teapot", category: "client", description: "An April Fools' status from RFC 2324, now reserved but not used by real servers." },
  { code: 421, name: "Misdirected Request", category: "client", description: "The request reached a server that cannot produce a response for this authority." },
  { code: 422, name: "Unprocessable Content", category: "client", description: "The syntax is valid but the content cannot be processed, often a validation failure." },
  { code: 423, name: "Locked", category: "client", description: "The target resource is locked by another operation (WebDAV)." },
  { code: 424, name: "Failed Dependency", category: "client", description: "The request failed because a previous request in the same transaction failed." },
  { code: 425, name: "Too Early", category: "client", description: "The server refuses to process a replayable request that may be replayed." },
  { code: 426, name: "Upgrade Required", category: "client", description: "The client must switch to a different protocol, such as TLS, to proceed." },
  { code: 428, name: "Precondition Required", category: "client", description: "The server requires the request to be conditional to prevent lost updates." },
  { code: 429, name: "Too Many Requests", category: "client", description: "The client exceeded a rate limit; retry after the period in Retry-After." },
  { code: 431, name: "Request Header Fields Too Large", category: "client", description: "The request headers exceed the server's size limit, usually from oversized cookies." },
  { code: 451, name: "Unavailable For Legal Reasons", category: "client", description: "The resource is blocked for legal or policy reasons, often in a specific region." },
  // 5xx
  { code: 500, name: "Internal Server Error", category: "server", description: "The server hit an unexpected condition and could not complete the request." },
  { code: 501, name: "Not Implemented", category: "server", description: "The server does not support the request method or functionality required." },
  { code: 502, name: "Bad Gateway", category: "server", description: "A gateway or proxy received an invalid response from the upstream server." },
  { code: 503, name: "Service Unavailable", category: "server", description: "The server is overloaded or down for maintenance; retry later." },
  { code: 504, name: "Gateway Timeout", category: "server", description: "A gateway or proxy did not receive a timely response from the upstream server." },
  { code: 505, name: "HTTP Version Not Supported", category: "server", description: "The server does not support the HTTP version used in the request." },
  { code: 506, name: "Variant Also Negotiates", category: "server", description: "Content negotiation is misconfigured and loops on itself." },
  { code: 507, name: "Insufficient Storage", category: "server", description: "The server cannot store the representation needed to complete the request (WebDAV)." },
  { code: 508, name: "Loop Detected", category: "server", description: "The server detected an infinite loop while processing a WebDAV request." },
  { code: 510, name: "Not Extended", category: "server", description: "Further extensions to the request are required for the server to fulfil it." },
  { code: 511, name: "Network Authentication Required", category: "server", description: "The client must authenticate to gain network access, such as a captive portal." },
];

export type PortProtocol = "tcp" | "udp" | "both";

export interface PortEntry {
  port: number;
  service: string;
  protocol: PortProtocol;
  description: string;
}

export const COMMON_PORTS: PortEntry[] = [
  { port: 7, service: "echo", protocol: "both", description: "Echoes back whatever is sent; used for diagnostics." },
  { port: 20, service: "ftp-data", protocol: "tcp", description: "FTP data channel in active mode." },
  { port: 21, service: "ftp", protocol: "tcp", description: "File Transfer Protocol control channel." },
  { port: 22, service: "ssh", protocol: "tcp", description: "Secure Shell remote login, SFTP, and SCP." },
  { port: 23, service: "telnet", protocol: "tcp", description: "Unencrypted remote terminal; avoid on untrusted networks." },
  { port: 25, service: "smtp", protocol: "tcp", description: "Mail transfer between servers; usually blocked for end users." },
  { port: 53, service: "dns", protocol: "both", description: "Domain name resolution; TCP for large answers and zone transfers." },
  { port: 67, service: "dhcp-server", protocol: "udp", description: "DHCP server listens here for address requests." },
  { port: 68, service: "dhcp-client", protocol: "udp", description: "DHCP client listens here for server replies." },
  { port: 69, service: "tftp", protocol: "udp", description: "Trivial File Transfer Protocol for simple boot and config downloads." },
  { port: 80, service: "http", protocol: "tcp", description: "Unencrypted HTTP web traffic." },
  { port: 88, service: "kerberos", protocol: "both", description: "Kerberos authentication tickets." },
  { port: 110, service: "pop3", protocol: "tcp", description: "Post Office Protocol, unencrypted mail retrieval." },
  { port: 111, service: "rpcbind", protocol: "both", description: "ONC RPC portmapper for NFS and related services." },
  { port: 119, service: "nntp", protocol: "tcp", description: "Network News Transfer Protocol for Usenet." },
  { port: 123, service: "ntp", protocol: "udp", description: "Network Time Protocol clock synchronization." },
  { port: 135, service: "msrpc", protocol: "tcp", description: "Microsoft RPC endpoint mapper." },
  { port: 137, service: "netbios-ns", protocol: "udp", description: "NetBIOS name service." },
  { port: 138, service: "netbios-dgm", protocol: "udp", description: "NetBIOS datagram service." },
  { port: 139, service: "netbios-ssn", protocol: "tcp", description: "NetBIOS session service used by legacy SMB." },
  { port: 143, service: "imap", protocol: "tcp", description: "Internet Message Access Protocol, unencrypted mail access." },
  { port: 161, service: "snmp", protocol: "udp", description: "Simple Network Management Protocol queries." },
  { port: 162, service: "snmptrap", protocol: "udp", description: "SNMP trap receiver for device alerts." },
  { port: 179, service: "bgp", protocol: "tcp", description: "Border Gateway Protocol peering between routers." },
  { port: 194, service: "irc", protocol: "tcp", description: "Internet Relay Chat." },
  { port: 389, service: "ldap", protocol: "both", description: "Lightweight Directory Access Protocol, usually unencrypted." },
  { port: 443, service: "https", protocol: "tcp", description: "HTTP over TLS; also carries HTTP/2 and WebSocket traffic." },
  { port: 443, service: "http3", protocol: "udp", description: "HTTP/3 over QUIC on UDP." },
  { port: 445, service: "smb", protocol: "tcp", description: "SMB file and printer sharing directly over TCP." },
  { port: 465, service: "smtps", protocol: "tcp", description: "SMTP over implicit TLS." },
  { port: 500, service: "isakmp", protocol: "udp", description: "IPsec Internet Key Exchange." },
  { port: 514, service: "syslog", protocol: "udp", description: "Syslog message collection; TCP is defined but less common." },
  { port: 515, service: "lpd", protocol: "tcp", description: "Line Printer Daemon printing protocol." },
  { port: 587, service: "submission", protocol: "tcp", description: "Authenticated SMTP submission for sending mail." },
  { port: 631, service: "ipp", protocol: "both", description: "Internet Printing Protocol, also used by CUPS." },
  { port: 636, service: "ldaps", protocol: "tcp", description: "LDAP over TLS." },
  { port: 873, service: "rsync", protocol: "tcp", description: "rsync daemon file synchronization." },
  { port: 989, service: "ftps-data", protocol: "tcp", description: "FTP data channel over TLS." },
  { port: 990, service: "ftps", protocol: "tcp", description: "FTP control channel over implicit TLS." },
  { port: 993, service: "imaps", protocol: "tcp", description: "IMAP over implicit TLS." },
  { port: 995, service: "pop3s", protocol: "tcp", description: "POP3 over implicit TLS." },
  { port: 1080, service: "socks", protocol: "tcp", description: "SOCKS proxy, commonly used for tunneling." },
  { port: 1194, service: "openvpn", protocol: "both", description: "OpenVPN tunnel; UDP is the default, TCP is a fallback." },
  { port: 1433, service: "mssql", protocol: "tcp", description: "Microsoft SQL Server client connections." },
  { port: 1521, service: "oracle", protocol: "tcp", description: "Oracle Database listener." },
  { port: 1723, service: "pptp", protocol: "tcp", description: "Point-to-Point Tunneling Protocol control channel." },
  { port: 1883, service: "mqtt", protocol: "tcp", description: "MQTT broker for unencrypted IoT messaging." },
  { port: 2049, service: "nfs", protocol: "tcp", description: "Network File System; UDP support is largely obsolete." },
  { port: 2181, service: "zookeeper", protocol: "tcp", description: "Apache ZooKeeper client port." },
  { port: 2222, service: "ssh-alt", protocol: "tcp", description: "Common alternate SSH port." },
  { port: 2375, service: "docker", protocol: "tcp", description: "Unencrypted Docker daemon API; never expose publicly." },
  { port: 2376, service: "docker-tls", protocol: "tcp", description: "Docker daemon API over TLS." },
  { port: 2379, service: "etcd-client", protocol: "tcp", description: "etcd client API, often used by Kubernetes." },
  { port: 2380, service: "etcd-peer", protocol: "tcp", description: "etcd peer-to-peer replication." },
  { port: 3000, service: "grafana", protocol: "tcp", description: "Default Grafana dashboard port and many dev servers." },
  { port: 3306, service: "mysql", protocol: "tcp", description: "MySQL and MariaDB client connections." },
  { port: 3389, service: "rdp", protocol: "both", description: "Microsoft Remote Desktop; UDP is used for transport acceleration." },
  { port: 4222, service: "nats", protocol: "tcp", description: "NATS client connections." },
  { port: 4500, service: "ipsec-nat-t", protocol: "udp", description: "IPsec NAT traversal encapsulation." },
  { port: 5000, service: "docker-registry", protocol: "tcp", description: "Common local Docker registry and development server port." },
  { port: 5060, service: "sip", protocol: "both", description: "SIP signaling for VoIP calls." },
  { port: 5061, service: "sips", protocol: "tcp", description: "SIP over TLS." },
  { port: 5222, service: "xmpp-client", protocol: "tcp", description: "XMPP client-to-server connections." },
  { port: 5269, service: "xmpp-server", protocol: "tcp", description: "XMPP server-to-server federation." },
  { port: 5432, service: "postgresql", protocol: "tcp", description: "PostgreSQL client connections." },
  { port: 5672, service: "amqp", protocol: "tcp", description: "RabbitMQ and other AMQP 0-9-1 brokers." },
  { port: 5683, service: "coap", protocol: "udp", description: "Constrained Application Protocol for IoT devices." },
  { port: 5900, service: "vnc", protocol: "tcp", description: "Virtual Network Computing remote desktop." },
  { port: 5984, service: "couchdb", protocol: "tcp", description: "Apache CouchDB HTTP API." },
  { port: 6379, service: "redis", protocol: "tcp", description: "Redis client connections." },
  { port: 6443, service: "kubernetes-api", protocol: "tcp", description: "Kubernetes API server, commonly secure." },
  { port: 6667, service: "irc", protocol: "tcp", description: "IRC server, often plaintext." },
  { port: 8080, service: "http-alt", protocol: "tcp", description: "Common HTTP alternate, proxy, and development port." },
  { port: 8443, service: "https-alt", protocol: "tcp", description: "Common HTTPS alternate and admin console port." },
  { port: 8883, service: "mqtt-tls", protocol: "tcp", description: "MQTT over TLS." },
  { port: 9000, service: "php-fpm", protocol: "tcp", description: "PHP FastCGI and many application admin servers." },
  { port: 9090, service: "prometheus", protocol: "tcp", description: "Prometheus server UI and API." },
  { port: 9092, service: "kafka", protocol: "tcp", description: "Apache Kafka broker client connections." },
  { port: 9200, service: "elasticsearch", protocol: "tcp", description: "Elasticsearch HTTP REST API." },
  { port: 9300, service: "elasticsearch-transport", protocol: "tcp", description: "Elasticsearch node-to-node transport." },
  { port: 9418, service: "git", protocol: "tcp", description: "Git protocol, unauthenticated and rarely used." },
  { port: 11211, service: "memcached", protocol: "both", description: "Memcached cache; UDP support is deprecated." },
  { port: 15672, service: "rabbitmq-management", protocol: "tcp", description: "RabbitMQ management UI and HTTP API." },
  { port: 25565, service: "minecraft", protocol: "tcp", description: "Minecraft Java Edition server." },
  { port: 27017, service: "mongodb", protocol: "tcp", description: "MongoDB server and mongos." },
  { port: 27018, service: "mongodb-shard", protocol: "tcp", description: "MongoDB shard server in a sharded cluster." },
  { port: 32400, service: "plex", protocol: "tcp", description: "Plex Media Server web and streaming port." },
  { port: 51820, service: "wireguard", protocol: "udp", description: "WireGuard VPN." },
  { port: 61616, service: "activemq", protocol: "tcp", description: "Apache ActiveMQ OpenWire connector." },
];

export interface UserAgentPreset {
  label: string;
  value: string;
}

export const UA_PRESETS: UserAgentPreset[] = [
  {
    label: "Chrome on Windows",
    value:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  },
  {
    label: "Chrome on macOS",
    value:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  },
  {
    label: "Safari on macOS",
    value:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  },
  {
    label: "Firefox on Windows",
    value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0",
  },
  {
    label: "Edge on Windows",
    value:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0",
  },
  {
    label: "Safari on iPhone",
    value:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  },
  {
    label: "Chrome on Android",
    value:
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
  },
  {
    label: "Googlebot",
    value:
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  },
];
