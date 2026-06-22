// Controlled classification vocabulary for PSDL presets (the catalog-layer
// governance the PSDL spec deliberately leaves out — see core spec §1.1).
//
// The language fixes only the *shape* of `meta.tags` / `meta.family`; the
// *vocabulary* lives here. Adding a term is a one-line edit, no core/version
// change. `scripts/taxcheck.ts` fails the build if a preset uses a term absent
// from these sets, keeping classification consistent across ~184 documents.

/** Allowed `meta.tags` values (free-form axis: layer + function). */
export const ALLOWED_TAGS: ReadonlySet<string> = new Set([
  // protocol layer
  "link-layer", "internet-layer", "transport", "application",
  // function
  "addressing", "routing", "signaling", "control-plane", "management",
  "security", "tunnel", "encapsulation", "multicast", "mobility",
  "discovery", "naming", "configuration", "telemetry", "time",
  "tcp-based", "udp-based",
]);

/** Allowed `meta.family` grouping keys. */
export const ALLOWED_FAMILIES: ReadonlySet<string> = new Set([
  "ip", "ipv4", "ipv6", "arp", "icmp",
  "tcp", "udp", "dccp", "sctp", "quic",
  "bgp", "ospf", "isis", "rip", "babel", "ldp",
  "dns", "dhcp", "bootp", "radius", "diameter",
  "coap", "mqtt", "http", "rtp", "sip",
  "tls", "dtls", "ipsec",
  "bfd", "bmp", "capwap", "ancp", "cops", "amt", "vxlan", "geneve", "mpls",
]);
