// Controlled classification vocabulary for the preset catalog.
//
// PSDL 0.5 §1.1 fixes only the *shape* of meta.tags (string[]) and meta.family
// (string) and deliberately leaves the *vocabulary* to the catalog/tooling
// layer. This file is that layer: scripts/taxcheck.ts (wired into `npm run
// check`) fails if any preset uses a tag or family not registered here, keeping
// classification consistent across the 184 documents. Adding a term is a
// one-line edit — no core/spec/version change.

/**
 * Allowed `meta.tags` values — a CLOSED multi-axis vocabulary.
 *  - layer (use exactly one): link-layer | internet-layer | transport | application
 *  - substrate (optional):    tcp-based | udp-based
 *  - function (one or more):  the rest
 */
export const ALLOWED_TAGS: ReadonlySet<string> = new Set([
  // layer
  "link-layer", "internet-layer", "transport", "application",
  // substrate
  "tcp-based", "udp-based",
  // function
  "addressing", "routing", "signaling", "control-plane", "management",
  "security", "authentication", "key-exchange", "tunnel", "encapsulation",
  "multicast", "mobility", "discovery", "naming", "configuration",
  "telemetry", "monitoring", "measurement", "time", "error-reporting",
  "neighbor-discovery", "reliability", "qos", "framing", "data-transfer",
]);

/**
 * Allowed `meta.family` grouping keys. A family groups the message-type
 * documents of one protocol (e.g. the nine BGP documents under `bgp`).
 * Singletons use the protocol's own short base name.
 */
export const ALLOWED_FAMILIES: ReadonlySet<string> = new Set([
  // link layer
  "ethernet", "vlan", "stp", "lacp", "macsec", "lldp", "eap", "eapol",
  "ppp", "pppoe", "mpls", "pcie", "ieee80211Mac", "rohc",
  // internet layer
  "ip", "arp", "icmp", "isis", "ospf", "rip", "eigrp", "babel", "ldp",
  "pim", "igmp-mld", "msdp", "dvmrp", "rsvp", "pcep", "lisp", "gist",
  "hip", "send", "vrrp", "nsh", "gre", "nvgre", "geneve", "vxlan", "teredo",
  // transport
  "tcp", "udp", "udplite", "sctp", "dccp", "quic", "pgm", "bfd",
  // tunneling / mobility / l2 over l3
  "ipsec", "l2tp", "gtp",
  // application
  "dns", "dhcp", "ntp", "snmp", "radius", "diameter", "tacacs", "kerberos",
  "tls", "dtls", "ssh", "http", "coap", "mqtt", "rtp", "rtmp",
  "stun-turn", "sip", "socks", "syslog", "smb", "rpc", "iscsi", "ocsp",
  "tftp", "slp", "ipfix", "sflow", "owamp-twamp", "bgp", "bmp",
  "cops", "ancp", "capwap", "amt", "natpmp", "pcp",
]);
