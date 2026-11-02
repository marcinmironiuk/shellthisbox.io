---
title: "Nmap for Pentesters — Part 3: Practical Workflow & Cheat Sheet"
linkTitle: "Practical Workflow & Cheat Sheet"
description: "A repeatable OSCP-style Nmap workflow: save scans, prioritize services, troubleshoot results, tune speed, and use a practical cheat sheet."
date: 2026-11-02
draft: false
topic: "Network Enumeration"
level: "Beginner"
series: "Nmap for Pentesters"
series_order: 3
weight: 3
---

Knowing Nmap commands is useful. Having a **repeatable enumeration workflow** is better.

In [Part 1]({{< relref "01-host-discovery-tcp.md" >}}) we covered host discovery and TCP scanning. In [Part 2]({{< relref "02-service-enumeration.md" >}}) we identified services, used NSE, and checked UDP. This final part puts those pieces together into something I can use on every HTB-style target.

> **Lab scope:** Run these commands only on authorized targets. The host `10.10.10.10` and the sample results are fictional.

## The workflow I actually want to follow

### Step 1 — Create a workspace

```bash
mkdir -p HTB-Target/{scans,enumeration}
cd HTB-Target
export TARGET=10.10.10.10
```

I want the results in one place, with the target IP stored in a variable so I can reuse the commands without retyping the address.

### Step 2 — Quick TCP discovery

```bash
sudo nmap -sS -n --open -oA scans/tcp-initial "$TARGET"
```

`-sS` performs a SYN scan; `-n` disables reverse DNS lookups; `--open` shows open or potentially open ports; `-oA` saves three output formats.

`--open` is useful for keeping the initial output readable, but it hides filtered and closed results. If filtering looks relevant, inspect a scan without that option. Remove `-n` when hostname information matters.

Suppose the first pass returns:

```text
PORT    STATE SERVICE
21/tcp  open  ftp
22/tcp  open  ssh
80/tcp  open  http
445/tcp open  microsoft-ds
```

### Step 3 — Check the full TCP range

```bash
sudo nmap -sS -p- -n -oA scans/tcp-full "$TARGET"
```

Imagine this also finds `8085/tcp`. That's exactly why the default 1,000-port scan isn't the end of discovery.

### Step 4 — Identify the services

```bash
sudo nmap -sC -sV -p 21,22,80,445,8085 \
  -oA scans/tcp-services "$TARGET"
```

A hypothetical result:

```text
PORT     STATE SERVICE       VERSION
21/tcp   open  ftp           vsftpd 3.0.3
22/tcp   open  ssh           OpenSSH 8.2p1
80/tcp   open  http          Apache httpd 2.4.41
445/tcp  open  microsoft-ds
8085/tcp open  http          Jetty 9.4.x
```

These are leads—not confirmed vulnerabilities.

### Step 5 — Investigate deliberately

| Port | Next question |
| --- | --- |
| `21` | Does FTP allow anonymous login? |
| `22` | Do I have credentials worth testing? |
| `80` | What application is behind HTTP? |
| `445` | Which SMB shares and permissions are visible? |
| `8085` | What is the second web service? |

A few focused checks:

```bash
nmap -p 21 --script ftp-anon "$TARGET"
nmap -p 80,8085 --script http-title,http-headers "$TARGET"
nmap -p 445 --script smb-os-discovery,smb-enum-shares "$TARGET"
```

Each command should answer a question. If it doesn't, consider why you're running it.

### Step 6 — Check UDP

```bash
sudo nmap -sU --top-ports 20 -oA scans/udp-initial "$TARGET"
```

If DNS, SNMP, or another service looks promising, investigate the specific ports with `-sU -sV`. If the results aren't useful, document the coverage and keep going.

### Step 7 — Write down what's confirmed and what's not

With `-oA`, Nmap creates `.nmap` (readable), `.xml` (structured), and `.gnmap` (legacy grepable) files.

My notes can be very simple:

```markdown
# Target: 10.10.10.10

## Open TCP ports
- 21 FTP
- 22 SSH
- 80 HTTP
- 445 SMB
- 8085 HTTP

## Findings
- FTP anonymous login: not checked
- SMB shares: not enumerated
- HTTP 8085: Jetty detected; application unknown

## Next steps
- [ ] Check anonymous FTP
- [ ] Inspect both web services
- [ ] Enumerate SMB shares
- [ ] Review UDP results
```

**"Not checked" and "checked, nothing found" are not the same thing.** That distinction stops me from making bad assumptions when I return to a machine later.

## Make scans faster without making them worse

On a reliable lab network, `-T4` can speed up a scan:

```bash
sudo nmap -sS -p- -T4 "$TARGET"
```

You may also see:

```bash
sudo nmap -sS -p- -T4 --min-rate 1000 "$TARGET"
```

`--min-rate 1000` asks Nmap to aim for a minimum packet-sending rate during relevant scan phases. It doesn't guarantee runtime or accuracy. Aggressive settings can cause missed responses over a poor VPN connection or against rate-limited targets.

**A fast, incomplete scan can cost more time than a slower, reliable one.** If something looks odd, validate it with a focused scan.

## Quick troubleshooting

| Problem | What I'd try |
| --- | --- |
| Host appears down | Check VPN/routing, then `nmap -Pn TARGET`. |
| Unknown service | `nmap -sV --version-all -p 8085 TARGET`. |
| UDP says `open\|filtered` | `sudo nmap -sU -sV -p 161 TARGET` may help clarify it. |
| No privileges for SYN scan | Use `nmap -sT TARGET`. |
| Scan takes forever | Check filtering, packet loss, UDP probes, and unnecessary scripts before raising the packet rate. |

Don't mistake `-Pn` for a firewall bypass, and don't assume version detection will identify every unusual service.

## Nmap cheat sheet

I keep this short on purpose. These are the commands I would actually want nearby while working through a lab.

| Task | Command |
| --- | --- |
| Default TCP scan | `nmap TARGET` |
| Skip host discovery | `nmap -Pn TARGET` |
| Discover hosts | `nmap -sn 10.10.10.0/24` |
| SYN scan | `sudo nmap -sS TARGET` |
| TCP Connect scan | `nmap -sT TARGET` |
| All TCP ports | `sudo nmap -sS -p- TARGET` |
| Selected ports | `nmap -p 21,22,80,445 TARGET` |
| Service detection | `nmap -sV TARGET` |
| Default scripts + versions | `nmap -sC -sV TARGET` |
| Top 20 UDP ports | `sudo nmap -sU --top-ports 20 TARGET` |
| Targeted UDP fingerprinting | `sudo nmap -sU -sV -p 53,161 TARGET` |
| FTP anonymous access | `nmap -p 21 --script ftp-anon TARGET` |
| HTTP titles / headers | `nmap -p 80 --script http-title,http-headers TARGET` |
| SMB shares | `nmap -p 445 --script smb-enum-shares TARGET` |
| Save all output formats | `nmap -oA scan TARGET` |
| Read script documentation | `nmap --script-help SCRIPT_NAME` |

## Final thoughts

I don't want to memorize every Nmap flag. I want a method I can repeat reliably:

**Discover → Identify → Enumerate → Investigate → Document.**

Finding open ports is easy. Knowing what to do with them is the skill worth developing.

**Series navigation:** [Part 1: Discovery & TCP]({{< relref "01-host-discovery-tcp.md" >}}) · [Part 2: Services & NSE]({{< relref "02-service-enumeration.md" >}}) · Part 3: Workflow & Cheat Sheet

## Further reading

- [Official Nmap Reference Guide](https://nmap.org/book/man.html)
- [Nmap Scripting Engine](https://nmap.org/book/nse-usage.html)


