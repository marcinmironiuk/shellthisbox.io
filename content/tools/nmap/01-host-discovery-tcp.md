---
title: "Nmap for Pentesters — Part 1: Host Discovery & TCP Scanning"
date: 2026-11-01
draft: false
description: "Start an OSCP-style assessment with Nmap: host discovery, TCP SYN and Connect scans, port states, and full-port coverage."
tags: ["nmap", "oscp", "hack-the-box", "enumeration", "pentesting"]
topic: "Network Enumeration"
level: "Beginner"
series: "Nmap for Pentesters"
series_order: 1
weight: 1
---

Nmap is one of the first tools you'll come across when learning penetration testing. It's also one of the tools you'll probably use most often when working on Hack The Box machines.

At first, running a basic scan seems straightforward. You enter an IP address, get a list of open ports, and start looking at the services. But as you work through more machines, you begin to realize there's more to it.

In this three-part series, I'll cover the Nmap commands and techniques I'm learning and using while practicing on Hack The Box and preparing for the OSCP.



> **Lab scope:** Use these commands only against systems you're authorized to assess. `10.10.10.10` is an illustrative lab IP; example scan results are fictional.

## Start with questions, not flags

At the beginning of an assessment, I want answers to four questions:

1. Is the host reachable?
2. Which ports are open?
3. What's running behind them?
4. What should I check next?

We'll tackle the first two here. The other questions are covered in [Part 2: Service Enumeration, NSE & UDP]({{< relref "tools/nmap/02-service-enumeration.md" >}}).

## Understanding port states

| State | What it means |
| --- | --- |
| `open` | An application is accepting connections on that port. |
| `closed` | The port is reachable, but nothing is listening. |
| `filtered` | Filtering prevents Nmap from deciding whether the port is open. |
| `open\|filtered` | Nmap cannot distinguish an open port from a filtered one. |

**Don't mistake `filtered` for `closed`.** A firewall dropping packets can leave Nmap without enough evidence to classify the port.

## The target appears down. Is it?

Sometimes Nmap prints:

```text
Note: Host seems down.
If it is really up, but blocking our ping probes, try -Pn
```

This doesn't prove the machine is offline. By default, Nmap checks whether a target appears to be up before proceeding with the port scan. Some hosts don't answer those discovery probes.

If the lab platform says the machine is running, try:

```bash
nmap -Pn 10.10.10.10
```

`-Pn` skips host discovery and treats the target as online. It **does not bypass a firewall**. On large address ranges, it can also make scanning much slower because Nmap attempts to scan every specified host.

If you need to discover which hosts respond inside an authorized subnet, without port scanning:

```bash
nmap -sn 10.10.10.0/24
```

For a single HTB target I generally move straight to port scanning. If it looks down unexpectedly, I check the VPN, routing, and machine status before throwing random options at Nmap.

## Your first TCP scan

On Kali, with the necessary privileges, a SYN scan is a good default:

```bash
sudo nmap -sS 10.10.10.10
```

`-sS` sends a TCP SYN and examines the response without normally completing the connection. A `SYN/ACK` generally suggests `open`; a `RST` suggests `closed`. Filtering can make the picture less clear.

Without raw-packet privileges, use a TCP Connect scan:

```bash
nmap -sT 10.10.10.10
```

`-sT` uses the operating system to complete TCP connections. Both scan types can be logged or detected; **SYN scanning is not invisible**.

## The 1,000-port trap

This simple command:

```bash
nmap 10.10.10.10
```

scans the **1,000 most common TCP ports** by default, not every possible TCP port. That's useful for an initial overview, but it's not complete coverage.

Suppose the target has these open ports:

```text
PORT     STATE SERVICE
22/tcp   open  ssh
80/tcp   open  http
8085/tcp open  http
```

An application on `8085/tcp` might be the most interesting service on the machine. A default scan may not find it.

To check all TCP ports from 1 through 65535:

```bash
sudo nmap -sS -p- 10.10.10.10
```

`-p-` is one of the options I don't want to forget during an assessment.

## Save the results from the beginning

Before scanning, I create a directory for output:

```bash
mkdir -p scans
sudo nmap -sS -n -oA scans/tcp-initial 10.10.10.10
```

| Option | Why I use it |
| --- | --- |
| `-sS` | TCP SYN scanning. |
| `-n` | Skip reverse DNS lookups when names aren't relevant. |
| `-oA` | Save readable, XML, and legacy grepable output. |

`-oA scans/tcp-initial` produces `tcp-initial.nmap`, `tcp-initial.xml`, and `tcp-initial.gnmap` in the `scans/` directory.

Then I run the full TCP scan:

```bash
sudo nmap -sS -p- -n -oA scans/tcp-full 10.10.10.10
```

**Practical rule:** start with a quick overview, but don't declare TCP enumeration complete until you've considered the full port range.

## What I take away from Part 1

At this point, I should have a list of discovered TCP ports and saved scan output. I don't need to guess at vulnerabilities yet. The next job is to work out what the services actually are and which ones deserve attention.

**Next:** [Part 2 — Service Enumeration, NSE & UDP]({{< relref "tools/nmap/02-service-enumeration.md" >}}).

**Series navigation:** Part 1: Discovery & TCP · [Part 2: Services & NSE]({{< relref "tools/nmap/02-service-enumeration.md" >}}) · [Part 3: Workflow & Cheat Sheet]({{< relref "tools/nmap/03-practical-workflow.md" >}})
