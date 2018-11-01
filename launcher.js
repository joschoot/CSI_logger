/*
Copyright (c) 2018 Pum Walters, HvA

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

This software is created for educational purposes and should 
never be used in a production environment.

This file starts a number of REST servers, listed below. It uses Notesto's simplified HTTP calls.

YellowPages: a subscription service where services can find eachother
	provide: here, a server describes a service that it offers.
	require: here, a server describes all services that it needs. 
		For each required service, the server will receive a /fulfill message describing 
		a provider (either immediately or as soon as the service is 'provided')
IDManager: a service persisting user names and hashed passwords
	verify: check if the offered credentials are bona fide
RightsManager: a service which persists all roles attached to all users
	get: list of all rights/roles attached to a user
	set: sets the list of all rights/roles attached to a user
AccessManager: a service which checks access rights
	verify: checks is a user has the required right
	verify: check if the user has the required role

*/
var log4js = require('log4js');

log4js.configure({
  appenders: { CSI: { type: 'file', filename: 'CSI.log' } },
  categories: { default: { appenders: ['CSI'], level: 'info' } }
});

const logger = log4js.getLogger('CSI');
logger.level = 'INFO';

var Hapi = require('hapi'),
	nt = require("./notesto.js");
(function(nt){

	//$.DELETE('localhost:9999/reset');

	nt.xPOSTjson('localhost:9999/create',
		`{	name: 'YellowPages',
			port: 10000,
			version: 1,
			init: () => { $.trace(1,'YellowPages$init:1')
				$.services={};
				$.queue={};
				$.keys=$.ppks();
			},
			POST: {
				provide: ($) => { $.trace(1,'YellowPages$provide:1')
					var desc = $.BODY,
						srvc = desc.srvc;
					desc.ip = $.REQUEST.info.remoteAddress;
					$.services[srvc] = desc;
					
					console.log('###'+$.name+'$provide1',desc);
					if ($.queue.hasOwnProperty(srvc)) {
						$.queue[srvc].forEach((s) => {
							$.xPOSTjson(s.ip+':'+s.port+'/fulfil',desc);
						})
						delete $.queue[srvc]
					};
					console.log($.name+'$provide1',$.services);
					return 'OK'; 
				},
				require: ($) => { $.trace(1,'YellowPages$require:1')
					var ipR = $.REQUEST.info.remoteAddress,
						portR = $.BODY.port,
						srvcs = $.BODY.srvcs;
					console.log($.name+'$require1',srvcs);
					srvcs.forEach((s) => {
						console.log($.name+'$require2',s);
						if ($.services.hasOwnProperty(s)) {
							$.xPOSTjson(ipR+':'+portR+'/fulfil',$.services[s]);
						} else {
							if (!$.queue.hasOwnProperty(s)) {
								$.queue[s] = [];
							}
							$.queue[s].push({ip:ipR, port:portR});
							console.log($.name+'$require3',$.queue);
						}
					});
					return 'OK';
				}
			}
		}`)
	.then(nt.expect(/^SubServer.*$/,'Start a Subserver'))
	
	nt.xPOSTjson('localhost:9999/create',
		`{	name: 'ID-Manager',
			port: 10002,
			version: 1,
			init: () => { $.trace(1,'IDManager$init:1')
				$.keys=$.ppks();
				$.pwhashkey='/P:2[YeFs|DORA#te-.-p#!lVLU{4#)3o6ol|kF9^N|LowlXELGAlLw2hH3oTisV'
				$.xPOSTjson('localhost:10000/provide',{puk:$.keys.puk, pwhashkey:$.pwhashkey, 
					port:$.port, srvc:'idmngr'})
				$.users={
					root:$.chash('secretPassword1',$.pwhashkey)
				}
			},
			POST: {
				"verify/{unm}": ($) => { $.trace(1,'IDManager$verify/{unm}:1')
					var unm = $.PATH.unm,
						info = JSON.parse($.dcode($.BODY.toString('utf8'),$.keys.prik)),
						pwh = info.pwh;
					return $.users.hasOwnProperty(unm) && $.users[unm]===pwh ? 'OK' : 'KO';
				}
			},
		}`)
	.then(nt.expect(/^SubServer.*$/,'Start a Subserver'))

	nt.xPOSTjson('localhost:9999/create',
		`{	name: 'Access-Manager',
			port: 10003,
			version: 1,
			init: () => { $.trace(1,'AccessManager$init:1')
				$.keys=$.ppks();
				$.xPOSTjson('localhost:10000/provide',{puk:$.keys.puk, port:$.port, srvc:'accessmngr'})
				$.rights={
					root:['login','appstore']
				}
			},
			POST: {
				"verify/{unm}": ($) => { $.trace(1,'AccessManager$verify/{unm}:1')
					var unm = $.PATH.unm,
						info = $.BODY,
						right = info.right;
					return $.rights.hasOwnProperty(unm) && $.rights[unm].includes(right) ? 'OK' : 'KO';
				}
			},
		}`)
	.then(nt.expect(/^SubServer.*$/,'Start a Subserver'))

	nt.xPOSTjson('localhost:9999/create',
		`{	name: 'Login',
			port: 10001,
			version: 1,
			init: () => { $.trace(1,'Login$init:1')
				$.sessions={}
				console.log('login$a: 1'),
				$.xPOSTjson('localhost:10000/provide',{port:$.port, srvc:'login'})
				$.xPOSTjson('localhost:10000/require',{port:$.port, srvcs:['idmngr','accessmngr']})
			},
			POST: {
				fulfil: ($) => { $.trace(1,'Login$fulfil:1')
					$[$.BODY.srvc] = $.BODY;
				},
				keyExchange: ($) => {  $.trace(1,'Login$keyExchange:1')
					var sessionID = $.BODY.sessionID,
						privateSecret = $.secret(),
						publicSecret = $.BODY.publicSecret,
						sharedSecret = $.chash($.BODY.halfSecret,privateSecret),
						otherHalfSecret = $.chash(publicSecret,privateSecret),
						session = {
							privateSecret:privateSecret,
							sharedSecret:sharedSecret,
							sessionID:sessionID
						}
					$.sessions[sessionID] = session;
					return {halfSecret:otherHalfSecret};
				}
			},
			POSTS: {
				"login/{sid}": async ($) => {   $.trace(1,'Login$login/{sid}:1')
					var sid = $.PATH.sid,
						sess = $.sessions[sid],
						info = JSON.parse($.decrypt($.BODY.toString('utf8'),sess.sharedSecret)),
						username = sess.username = info.username,
						sessionToken = sess.sessionToken = $.mkGuid(),
						idmngr = $.idmngr,
						pwhashkey = idmngr.pwhashkey,
						pwhash = $.chash(info.password,pwhashkey),
						idOK = await $.xPOSTjson(idmngr.ip+':'+idmngr.port+'/verify/'+sess.username,
								ncode(JSON.stringify({pwh:pwhash}),idmngr.puk)),
						accessmngr = $.accessmngr,
						accsOK = await $.xPOSTjson(accessmngr.ip+':'+accessmngr.port+'/verify/'+sess.username,
								'login')
						
					return idOK==='KO'?
						{error:'unamePasswordMismatch'}:
							accsOK==='OK'?
								{error:'noLoginRights'}:
								{sessionToken:sess.sessionToken}
				}
			},
		}`)
	.then(nt.expect(/^SubServer.*$/,'Start a Subserver'))


	
}(nt));
