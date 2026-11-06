---
aliases: ["/tools/nmap/02-service-enumeration/"]
note_type: "guide"
note_area: "Enumeration"
note_topics: ["Nmap"]
note_platform: "Cross-platform"
title: "Nmap for Pentesters — Part 2: Service Enumeration, NSE & UDP"
linkTitle: "Service Enumeration, NSE & UDP"
description: "Identifying services, checking versions, and using Nmap scripts during enumeration."
date: 2026-11-02
draft: false
topic: "Network Enumeration"
level: "Beginner"
series: "Nmap for Pentesters"
series_order: 2
weight: 2
---

In [Part 1]({{< relref "/notes/Nmap-01-host-discovery-tcp.md" >}}), we found the target and checked its TCP ports. Now comes the part that matters: **turning a list of open ports into a plan.**

A port number is a clue. It isn't a service inventory, and it definitely isn't proof of a vulnerability.

> **Lab scope:** Run these commands only against authorized targets. The IP address `10.10.10.10` and any shown output are illustrative.

## Find out what is actually running

Service and version detection is a useful next step:

```bash
nmap -sV 10.10.10.10
```

For example, a scan might return:

```text
PORT    STATE SERVICE VERSION
21/tcp  open  ftp     vsftpd 3.0.3
22/tcp  open  ssh     OpenSSH 8.2p1
80/tcp  open  http    Apache httpd 2.4.41
```

You now have leads for research and further enumeration. But be careful: **the version string alone doesn't establish a vulnerability.** Banners may be inaccurate, and vendors sometimes backport patches without changing the reported version.

Nmap's default scripting selection can add useful details:

```bash
nmap -sC -sV 10.10.10.10
```

`-sC` runs the default NSE scripts; `-sV` attempts service/version detection. Once you've found the open ports, target just those ports:

```bash
nmap -sC -sV -p 21,22,80,445 10.10.10.10
```

This is often more effective than repeatedly scanning the default 1,000 ports.

## Read scan results as next actions

| Port | Service | What I'd ask next |
| --- | --- | --- |
| `21/tcp` | FTP | Is anonymous access enabled, and what is accessible? |
| `22/tcp` | SSH | Do I have valid credentials? Is the banner useful context? |
| `80/tcp` | HTTP | What application is this? Are there other hosts or endpoints? |
| `445/tcp` | SMB | Which shares and permissions can I enumerate? |

I don't immediately search for a CVE every time Nmap prints a version number. First I try to understand the service and its configuration.

## NSE: choose scripts with a purpose

The **Nmap Scripting Engine** can perform focused checks against individual services. On Kali, the scripts are commonly installed under:

```text
/usr/share/nmap/scripts/
```

You can search for likely scripts and read their help before using them:

```bash
ls /usr/share/nmap/scripts/ | grep smb
nmap --script-help smb-enum-shares
```

Here are four examples worth knowing.

## FTP: anonymous login

```bash
nmap -p 21 --script ftp-anon 10.10.10.10
```

If anonymous access works, the next question is whether exposed files or permissions matter in the context of the assessment. Anonymous access isn't always a security flaw by itself.

## HTTP: titles and headers

```bash
nmap -p 80,8085 --script http-title,http-headers 10.10.10.10
```

The page title and response headers may reveal an admin interface, framework, or application. For deeper web testing, I switch to a browser, HTTP proxy, and dedicated content-discovery tools. Nmap is the starting point, not the entire web-enumeration toolkit.

## SMB: system information and shares

```bash
nmap -p 445 --script smb-os-discovery,smb-enum-shares 10.10.10.10
```

Depending on the server configuration and authentication requirements, these checks may show host information or available shares. SMB deserves a separate, deeper guide.

## HTTPS: certificate names

```bash
nmap -p 443 --script ssl-cert 10.10.10.10
```

Certificate details can reveal additional hostnames or virtual-host clues **within the authorized scope**.

## Don't run every script blindly

NSE scripts include categories such as `safe`, `discovery`, `vuln`, `intrusive`, `brute`, and `dos`. Some checks can be disruptive, and even the default set isn't guaranteed to be completely passive.

**My rule:** if I can't explain what a script is supposed to tell me, I read its documentation before I run it.

## UDP: don't assume TCP is the whole picture

Useful services also run over UDP: DNS (`53`), TFTP (`69`), NTP (`123`), and SNMP (`161`) are common examples.

A basic UDP scan:

```bash
sudo nmap -sU 10.10.10.10
```

UDP can be slow and ambiguous because many services don't reply to unexpected traffic. A result such as this needs careful interpretation:

```text
PORT     STATE         SERVICE
53/udp   open          domain
161/udp  open|filtered snmp
```

`open|filtered` **does not prove** that SNMP is running. It means Nmap couldn't distinguish an open port from a filtered one.

For a first pass, I prefer a focused scan:

```bash
sudo nmap -sU --top-ports 20 10.10.10.10
```

If necessary, expand it:

```bash
sudo nmap -sU --top-ports 100 10.10.10.10
```

For promising ports, try protocol-aware version detection:

```bash
sudo nmap -sU -sV -p 53,161 10.10.10.10
```

This can help clarify some ambiguous results, but a silent service may remain `open|filtered`.

## The mindset to keep

By the end of this stage, I want to know which services I can meaningfully investigate—not just which ports responded. Each follow-up should answer a specific question, and untested services should stay on my list rather than quietly disappearing from my notes.

**Next:** [Part 3 — Practical Workflow & Cheat Sheet]({{< relref "/notes/Nmap-03-practical-workflow.md" >}})

**Series navigation:** [Part 1: Discovery & TCP]({{< relref "/notes/Nmap-01-host-discovery-tcp.md" >}}) · Part 2: Services & NSE · [Part 3: Practical Workflow & Cheat Sheet]({{< relref "/notes/Nmap-03-practical-workflow.md" >}})