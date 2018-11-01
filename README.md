https://github.com/hva-cybersec/CSI

There's a logger placed in the .js files. To use the logger install the log4js dependency with npm.
"npm install log4js"

If there's no CSI.log file available, the program will create one. The program creates the "CSI.log" file current working directory. 
Example:
cd /CSI_logger
node genericServer.js
node launcher.js

After this CSI.log is created in the /CSI_logger directory. 
The CSI.log can be used in Splunk for further analysis.
