import{Utils as e,LockingScript as r,OP as t,TransactionSignature as n,Hash as o,UnlockingScript as i,Transaction as s,PublicKey as u,Script as a,P2PKH as c,PrivateKey as f}from"@bsv/sdk";import*as d from"js-1sat-ord";function l(e,r){(null==r||r>e.length)&&(r=e.length);for(var t=0,n=Array(r);t<r;t++)n[t]=e[t];return n}function h(e,r){var t="undefined"!=typeof Symbol&&e[Symbol.iterator]||e["@@iterator"];if(t)return(t=t.call(e)).next.bind(t);if(Array.isArray(e)||(t=function(e,r){if(e){if("string"==typeof e)return l(e,r);var t={}.toString.call(e).slice(8,-1);return"Object"===t&&e.constructor&&(t=e.constructor.name),"Map"===t||"Set"===t?Array.from(e):"Arguments"===t||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t)?l(e,r):void 0}}(e))||r&&e&&"number"==typeof e.length){t&&(e=t);var n=0;return function(){return n>=e.length?{done:!0}:{done:!1,value:e[n++]}}}throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}var p=/*#__PURE__*/function(){function s(){}var u=s.prototype;return u.lock=function(n,o){var i=[];if("string"==typeof n){var s=e.fromBase58Check(n);if(0!==s.prefix[0]&&111!==s.prefix[0])throw new Error("only P2PKH is supported");i=s.data}else i=n;var u=new r;return u.writeOpCode(t.OP_DUP).writeOpCode(t.OP_HASH160).writeBin(i).writeOpCode(t.OP_EQUALVERIFY).writeOpCode(t.OP_CHECKSIGVERIFY).writeBin(o.encode(!0)).writeOpCode(t.OP_CHECKSIG),u},u.userUnlock=function(e,r,t,s,u){return void 0===r&&(r="all"),void 0===t&&(t=!1),{sign:function(a,c){try{var f,d,l,h=n.SIGHASH_FORKID;"all"===r&&(h|=n.SIGHASH_ALL),"none"===r&&(h|=n.SIGHASH_NONE),"single"===r&&(h|=n.SIGHASH_SINGLE),t&&(h|=n.SIGHASH_ANYONECANPAY);var p=a.inputs[c],v=a.inputs.filter(function(e,r){return r!==c}),m=p.sourceTXID?p.sourceTXID:null==(f=p.sourceTransaction)?void 0:f.id("hex");if(!m)throw new Error("The input sourceTXID or sourceTransaction is required for transaction signing.");if(s||(s=null==(d=p.sourceTransaction)?void 0:d.outputs[p.sourceOutputIndex].satoshis),!s)throw new Error("The sourceSatoshis or input sourceTransaction is required for transaction signing.");if(u||(u=null==(l=p.sourceTransaction)?void 0:l.outputs[p.sourceOutputIndex].lockingScript),!u)throw new Error("The lockingScript or input sourceTransaction is required for transaction signing.");var g=n.format({sourceTXID:m,sourceOutputIndex:p.sourceOutputIndex,sourceSatoshis:s,transactionVersion:a.version,otherInputs:v,inputIndex:c,outputs:a.outputs,inputSequence:p.sequence||4294967295,subscript:u,lockTime:a.lockTime,scope:h}),w=e.sign(o.sha256(g)),P=new n(w.r,w.s,h),y=new i;return y.writeBin(P.toChecksigFormat()),y.writeBin(e.toPublicKey().encode(!0)),Promise.resolve(y)}catch(e){return Promise.reject(e)}},estimateLength:function(){return Promise.resolve(182)}}},u.unlock=function(e,r,t,s,u,a){return void 0===t&&(t="all"),void 0===s&&(s=!1),{sign:function(c,f){try{var d,l,h,p=n.SIGHASH_FORKID;"all"===t&&(p|=n.SIGHASH_ALL),"none"===t&&(p|=n.SIGHASH_NONE),"single"===t&&(p|=n.SIGHASH_SINGLE),s&&(p|=n.SIGHASH_ANYONECANPAY);var v=c.inputs[f],m=c.inputs.filter(function(e,r){return r!==f}),g=v.sourceTXID?v.sourceTXID:null==(d=v.sourceTransaction)?void 0:d.id("hex");if(!g)throw new Error("The input sourceTXID or sourceTransaction is required for transaction signing.");if(u||(u=null==(l=v.sourceTransaction)?void 0:l.outputs[v.sourceOutputIndex].satoshis),!u)throw new Error("The sourceSatoshis or input sourceTransaction is required for transaction signing.");if(a||(a=null==(h=v.sourceTransaction)?void 0:h.outputs[v.sourceOutputIndex].lockingScript),!a)throw new Error("The lockingScript or input sourceTransaction is required for transaction signing.");var w=n.format({sourceTXID:g,sourceOutputIndex:v.sourceOutputIndex,sourceSatoshis:u,transactionVersion:c.version,otherInputs:m,inputIndex:f,outputs:c.outputs,inputSequence:v.sequence||4294967295,subscript:a,lockTime:c.lockTime,scope:p}),P=e.sign(o.sha256(w)),y=new n(P.r,P.s,p),I=new i;return I.writeBin(y.toChecksigFormat()),I.writeScript(r),Promise.resolve(I)}catch(e){return Promise.reject(e)}},estimateLength:function(){return Promise.resolve(182)}}},s}(),v=function(r){for(var n,i,s,u=0;u<r.chunks.length;u++){var a,c=r.chunks[u];u>=2&&3===(null==(a=c.data)?void 0:a.length)&&"ord"==e.toUTF8(c.data)&&r.chunks[u-1].op==t.OP_IF&&r.chunks[u-2].op==t.OP_FALSE&&(s=u+1)}if(void 0!==s){for(var f={file:{hash:"",size:0,type:""},fields:{}},d=s;d<r.chunks.length;d+=2){var l,h,p=r.chunks[d];if(p.op==t.OP_ENDIF)break;if(p.op>t.OP_16)return;var v=r.chunks[d+1];if(v.op>t.OP_PUSHDATA4)return;if(null==(l=p.data)||!l.length){var m=0;switch(p.op>t.OP_PUSHDATA4&&p.op<=t.OP_16?m=p.op-80:null!=(h=p.data)&&h.length&&(m=p.data[0]),m){case 0:if(f.file.size=(null==(n=v.data)?void 0:n.length)||0,null==(i=v.data)||!i.length)break;f.file.hash=e.toBase64(o.sha256(v.data)),f.file.content=v.data;break;case 1:f.file.type=Buffer.from(v.data||[]).toString()}}}return f}},m=function(r){return r.map(function(r){for(var n=r.chunks,o=0;o<=n.length-4;o++){var i,s,u;if(n.length>o+6&&n[0+o].op===t.OP_DUP&&n[1+o].op===t.OP_HASH160&&20===(null==(i=n[2+o].data)?void 0:i.length)&&n[3+o].op===t.OP_EQUALVERIFY&&n[4+o].op===t.OP_CHECKSIGVERIFY&&33===(null==(s=n[5+o].data)?void 0:s.length)&&n[6+o].op===t.OP_CHECKSIG)return{cosigner:e.toHex(n[5+o].data||[]),address:e.toBase58Check(n[2+o].data||[],[0])};if(n[0+o].op===t.OP_DUP&&n[1+o].op===t.OP_HASH160&&20===(null==(u=n[2+o].data)?void 0:u.length)&&n[3+o].op===t.OP_EQUALVERIFY&&n[4+o].op===t.OP_CHECKSIG)return{cosigner:"",address:e.toBase58Check(n[2+o].data||[],[0])}}})},g=function(r,t,n){var o=r.senders.includes(t)?"send":"receive",i=r.height>0?"confirmed":"unconfirmed";if(!r.rawtx)return null;var u=e.toArray(r.rawtx,"base64"),a=e.toHex(u),c=s.fromHex(a).outputs.map(function(e){return e.lockingScript}),f=m(c),d=c.map(v),l=f.map(function(e){return e.address}),h=l.indexOf(n.feeAddress),p=r.senders[0],g=0,w=new Map;d.forEach(function(r,o){var i,s=null==r||null==(i=r.file)?void 0:i.content;if(s){var u=e.toUTF8(s);if(u){var a;try{a=JSON.parse(u)}catch(e){return void console.error("Failed to parse inscription JSON:",e)}if("bsv-20"===a.p&&a.id===n.tokenId){var c=parseInt(a.amt,10);if(!Number.isNaN(c))if(h!==o||p!==t){var f=l[o],d=w.get(f)||0;w.set(f,d+c)}else g+=c}}}});var P=w.get(t)||0;if("send"===o){var y=w.get(p)||0;w.set(p,y-P)}var I=[],A=(I="receive"===o?[{address:p,amount:P}]:Array.from(w.entries()).map(function(e){return{address:e[0],amount:e[1]}}).filter(function(e){return e.address!==t&&e.address!==n.feeAddress&&e.amount>0})).reduce(function(e,r){return e+r.amount},0);return{txid:r.txid,height:r.height,type:o,status:i,amount:A,fee:g,score:r.score,counterparties:I}};function w(e,r){try{var t=e()}catch(e){return r(e)}return t&&t.then?t.then(void 0,r):t}function P(e,r,t){if(!e.s){if(t instanceof y){if(!t.s)return void(t.o=P.bind(null,e,r));1&r&&(r=t.s),t=t.v}if(t&&t.then)return void t.then(P.bind(null,e,r),P.bind(null,e,2));e.s=r,e.v=t;var n=e.o;n&&n(e)}}var y=/*#__PURE__*/function(){function e(){}return e.prototype.then=function(r,t){var n=new e,o=this.s;if(o){var i=1&o?r:t;if(i){try{P(n,1,i(this.v))}catch(e){P(n,2,e)}return n}return this}return this.o=function(e){try{var o=e.v;1&e.s?P(n,1,r?r(o):o):t?P(n,1,t(o)):P(n,2,o)}catch(e){P(n,2,e)}},n},e}();function I(e){return e instanceof y&&1&e.s}var A="undefined"!=typeof Symbol?Symbol.iterator||(Symbol.iterator=Symbol("Symbol.iterator")):"@@iterator";function T(e,r,t){if("function"==typeof e[A]){var n,o,i,s=function(e){try{for(;!((n=u.next()).done||t&&t());)if((e=r(n.value))&&e.then){if(!I(e))return void e.then(s,i||(i=P.bind(null,o=new y,2)));e=e.v}o?P(o,1,e):o=e}catch(e){P(o||(o=new y),2,e)}},u=e[A]();if(s(),u.return){var a=function(e){try{n.done||u.return()}catch(e){}return e};if(o&&o.then)return o.then(a,function(e){throw a(e)});a()}return o}if(!("length"in e))throw new TypeError("Object is not iterable");for(var c=[],f=0;f<e.length;f++)c.push(e[f]);return function(e,r,t){var n,o,i=-1;return function s(u){try{for(;++i<e.length&&(!t||!t());)if((u=r(i))&&u.then){if(!I(u))return void u.then(s,o||(o=P.bind(null,n=new y,2)));u=u.v}n?P(n,1,u):n=u}catch(e){P(n||(n=new y),2,e)}}(),n}(c,function(e){return r(c[e])},t)}var S=/*#__PURE__*/function(){function r(e){this.mneeApiToken="92982ec1c0975f31979da515d46bae9f",this.prodTokenId="ae59f3b898ec61acbdb6cc7a245fabeded0c094bf046f35206a3aec60ef88127_0",this.prodApprover="020a177d6a5e6f3a8689acd2e313bd1cf0dcf5a243d1cc67b7218602aee9e04b2f",this.prodAddress="1inHbiwj2jrEcZPiSYnfgJ8FmS1Bmk4Dh",this.devTokenId="833a7720966a2a435db28d967385e8aa7284b6150ebb39482cc5228b73e1703f_0",this.devAddress="1A1QNEkLuvAALsmG4Me3iubP8zb5C6jpv5",this.qaTokenId="55cde0733049a226fdb6abc387ee9dcd036e859f7cbc69ab90050c0435139f00_0",this.qaAddress="1BW7cejD27vDLiHsbK1Hvf1y4JTKvC1Yue",this.stageTokenId="833a7720966a2a435db28d967385e8aa7284b6150ebb39482cc5228b73e1703f_0",this.stageAddress="1AZNdbFYBDFTAEgzZMfPzANxyNrpGJZAUY",this.mneeApi="https://proxy-api.mnee.net",this.gorillaPoolApi="https://ordinals.1sat.app",this.mneeConfig=void 0,e&&(this.mneeApiToken=e),this.getConfig()}var t=r.prototype;return t.getConfig=function(){try{var e=this;return Promise.resolve(w(function(){return Promise.resolve(fetch(e.mneeApi+"/v1/config?auth_token="+e.mneeApiToken,{method:"GET"})).then(function(r){if(!r.ok)throw new Error("HTTP error! status: "+r.status);return Promise.resolve(r.json()).then(function(r){return e.mneeConfig=r,r})})},function(e){console.error("Failed to fetch config:",e)}))}catch(e){return Promise.reject(e)}},t.toAtomicAmount=function(e){if(!this.mneeConfig)throw new Error("Config not fetched");return Math.round(e*Math.pow(10,this.mneeConfig.decimals))},t.fromAtomicAmount=function(e){if(!this.mneeConfig)throw new Error("Config not fetched");return e/Math.pow(10,this.mneeConfig.decimals)},t.createInscription=function(e,r,t){try{var n={p:"bsv-20",op:"transfer",id:t.tokenId,amt:r.toString()};return Promise.resolve({lockingScript:d.applyInscription((new p).lock(e,u.fromString(t.approver)),{dataB64:Buffer.from(JSON.stringify(n)).toString("base64"),contentType:"application/bsv-20"}),satoshis:1})}catch(e){return Promise.reject(e)}},t.getUtxos=function(e,r){void 0===r&&(r=["transfer","deploy+mint"]);try{var t=this;return Promise.resolve(w(function(){return Promise.resolve(fetch(t.mneeApi+"/v1/utxos?auth_token="+t.mneeApiToken,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify([e])})).then(function(e){if(!e.ok)throw new Error("HTTP error! status: "+e.status);return Promise.resolve(e.json()).then(function(e){return r.length?e.filter(function(e){return r.includes(e.data.bsv21.op.toLowerCase())}):e})})},function(e){return console.error("Failed to fetch UTXOs:",e),[]}))}catch(e){return Promise.reject(e)}},t.broadcast=function(e){try{var r=this.gorillaPoolApi+"/v5/tx";return Promise.resolve(w(function(){return Promise.resolve(fetch(r,{method:"POST",headers:{"Content-Type":"application/octet-stream"},body:Buffer.from(e.toBinary())})).then(function(e){return Promise.resolve(e.json()).then(function(r){return e.ok?{status:"success",txid:r.txid,message:"Transaction broadcast successfully"}:{status:"error",code:e.status.toString(),description:r.error||"Unknown error"}})})},function(e){return console.error("Failed to broadcast:",e),{status:"error",code:"UNKNOWN",description:e instanceof Error?e.message:"Unknown error"}}))}catch(e){return Promise.reject(e)}},t.fetchBeef=function(e){try{return Promise.resolve(fetch(this.gorillaPoolApi+"/v5/tx/"+e+"/beef")).then(function(r){if(404===r.status)throw new Error("Transaction not found");if(200!==r.status)throw new Error(r.status+" - Failed to fetch beef for tx "+e);var t=Buffer,n=t.from;return Promise.resolve(r.arrayBuffer()).then(function(e){var r=[].concat(n.call(t,e));return s.fromAtomicBEEF(r)})})}catch(e){return Promise.reject(e)}},t.getSignatures=function(r,t){try{try{var i;switch(r.format){case"beef":i=s.fromHexBEEF(r.rawtx);break;case"ef":i=s.fromHexEF(r.rawtx);break;default:i=s.fromHex(r.rawtx)}var u=r.sigRequests.flatMap(function(r){return[t].map(function(t){var s=n.format({sourceTXID:r.prevTxid,sourceOutputIndex:r.outputIndex,sourceSatoshis:r.satoshis,transactionVersion:i.version,otherInputs:i.inputs.filter(function(e,t){return t!==r.inputIndex}),inputIndex:r.inputIndex,outputs:i.outputs,inputSequence:i.inputs[r.inputIndex].sequence||0,subscript:r.script?a.fromHex(r.script):(new c).lock(t.toPublicKey().toAddress()),lockTime:i.lockTime,scope:r.sigHashType||65}),u=t.sign(o.sha256(s)),f=new n(u.r,u.s,r.sigHashType||65);return{sig:e.toHex(f.toChecksigFormat()),pubKey:t.toPublicKey().toString(),inputIndex:r.inputIndex,sigHashType:r.sigHashType||65,csIdx:r.csIdx}})});return Promise.resolve({sigResponses:u})}catch(e){var f;return console.error("getSignatures error",e),Promise.resolve({error:{message:null!=(f=e.message)?f:"unknown",cause:e.cause}})}}catch(e){return Promise.reject(e)}},t.transfer=function(r,t){try{var o=this;return Promise.resolve(w(function(){function u(u){if(!u)throw new Error("Config not fetched");var c=r.reduce(function(e,r){return e+r.amount},0);if(c<=0)return{error:"Invalid amount"};var d=o.toAtomicAmount(c),l=f.fromWif(t),p=l.toAddress();return Promise.resolve(o.getUtxos(p)).then(function(t){var c,f;function p(t){if(f)return t;function i(){function r(){function r(){var r=m.inputs.map(function(e,r){var t,o;if(!e.sourceTXID)throw new Error("Source TXID is undefined");return{prevTxid:e.sourceTXID,outputIndex:e.sourceOutputIndex,inputIndex:r,address:w[r],script:null==(t=e.sourceTransaction)?void 0:t.outputs[e.sourceOutputIndex].lockingScript.toHex(),satoshis:(null==(o=e.sourceTransaction)?void 0:o.outputs[e.sourceOutputIndex].satoshis)||1,sigHashType:n.SIGHASH_ALL|n.SIGHASH_ANYONECANPAY|n.SIGHASH_FORKID}}),t=m.toHex();return Promise.resolve(o.getSignatures({rawtx:t,sigRequests:r},l)).then(function(r){if(null==r||!r.sigResponses)return{error:"Failed to get signatures"};for(var t,n=h(r.sigResponses);!(t=n()).done;){var i=t.value;m.inputs[i.inputIndex].unlockingScript=(new a).writeBin(e.toArray(i.sig,"hex")).writeBin(e.toArray(i.pubKey,"hex"))}var u=e.toBase64(m.toBinary());return Promise.resolve(fetch(o.mneeApi+"/v1/transfer?auth_token="+o.mneeApiToken,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({rawtx:u})})).then(function(r){if(!r.ok)throw new Error("HTTP error! status: "+r.status);return Promise.resolve(r.json()).then(function(r){var t=r.rawtx;if(!t)return{error:"Failed to broadcast transaction"};var n=e.toArray(t,"base64"),i=s.fromBinary(n);return Promise.resolve(o.broadcast(i)).then(function(){return{txid:i.id("hex"),rawtx:e.toHex(n)}})})})})}var t=g-d-v,i=function(){if(t>0){var e=m.addOutput;return Promise.resolve(o.createInscription(A,t,u)).then(function(r){e.call(m,r)})}}();return i&&i.then?i.then(r):r()}var t=function(){if(v>0){var e=m.addOutput;return Promise.resolve(o.createInscription(u.feeAddress,v,u)).then(function(r){e.call(m,r)})}}();return t&&t.then?t.then(r):r()}var c=T(r,function(e){var r=m.addOutput;return Promise.resolve(o.createInscription(e.address,o.toAtomicAmount(e.amount),u)).then(function(e){r.call(m,e)})});return c&&c.then?c.then(i):i()}if(t.reduce(function(e,r){return e+(r.data.bsv21.amt||0)},0)<d)return{error:"Insufficient MNEE balance"};var v=void 0!==r.find(function(e){return e.address===u.burnAddress})?0:null==(c=u.fees.find(function(e){return d>=e.min&&d<=e.max}))?void 0:c.fee;if(void 0===v)return{error:"Fee ranges inadequate"};var m=new s(1,[],[],0),g=0,w=[],A="",S=function(e,r,t){for(var n;;){var o=e();if(I(o)&&(o=o.v),!o)return i;if(o.then){n=0;break}var i=t();if(i&&i.then){if(!I(i)){n=1;break}i=i.s}}var s=new y,u=P.bind(null,s,2);return(0===n?o.then(c):1===n?i.then(a):(void 0).then(function(){(o=e())?o.then?o.then(c).then(void 0,u):c(o):P(s,1,i)})).then(void 0,u),s;function a(r){i=r;do{if(!(o=e())||I(o)&&!o.v)return void P(s,1,i);if(o.then)return void o.then(c).then(void 0,u);I(i=t())&&(i=i.v)}while(!i||!i.then);i.then(a).then(void 0,u)}function c(e){e?(i=t())&&i.then?i.then(a).then(void 0,u):a(i):P(s,1,i)}}(function(){return!f&&g<d+v},0,function(){var e=t.shift();return e?Promise.resolve(o.fetchBeef(e.txid)).then(function(r){if(!r)return f=1,{error:"Failed to fetch source transaction"};w.push(e.owners[0]),A=A||e.owners[0],m.addInput({sourceTXID:e.txid,sourceOutputIndex:e.vout,sourceTransaction:r,unlockingScript:new i}),g+=e.data.bsv21.amt}):(f=1,{error:"Insufficient MNEE balance"})});return S&&S.then?S.then(p):p(S)})}var c=o.mneeConfig;return c?u(c):Promise.resolve(o.getConfig()).then(u)},function(e){var r="Transaction submission failed";return e instanceof Error&&(r=e.message,e.message.includes("HTTP error")&&console.error("HTTP error details:",e)),console.error("Failed to transfer tokens:",r),{error:r}}))}catch(e){return Promise.reject(e)}},t.getBalance=function(e){try{var r=this;return Promise.resolve(w(function(){function t(t){if(!t)throw new Error("Config not fetched");return Promise.resolve(r.getUtxos(e)).then(function(e){var t=e.reduce(function(e,r){return"transfer"===r.data.bsv21.op&&(e+=r.data.bsv21.amt),e},0);return{amount:t,decimalAmount:r.fromAtomicAmount(t)}})}var n=r.mneeConfig;return n?t(n):Promise.resolve(r.getConfig()).then(t)},function(e){return console.error("Failed to fetch balance:",e),{amount:0,decimalAmount:0}}))}catch(e){return Promise.reject(e)}},t.validateMneeTx=function(r,t){try{var n=this;return Promise.resolve(w(function(){function o(o){if(!o)throw new Error("Config not fetched");var i=s.fromHex(r),u=i.outputs.map(function(e){return e.lockingScript}),a=m(u);return t?t.forEach(function(r,t){var s,u=r.address,c=r.amount;if(!a.find(function(e){return(null==e?void 0:e.cosigner)===o.approver}))throw new Error("Cosigner not found for address: "+u+" at index: "+t);if(!a.find(function(e){return(null==e?void 0:e.address)===u}))throw new Error("Address not found in script for address: "+u+" at index: "+t);var f=v(i.outputs[t].lockingScript),d=null==f||null==(s=f.file)?void 0:s.content;if(!d)throw new Error("Invalid inscription content");var l=e.toUTF8(d);if(!l)throw new Error("Invalid inscription content");var h=JSON.parse(l);if("bsv-20"!==h.p)throw new Error("Invalid bsv 20 protocol: "+h.p);if("transfer"!==h.op)throw new Error("Invalid operation: "+h.op);if(h.id!==o.tokenId)throw new Error("Invalid token id: "+h.id);if(h.amt!==n.toAtomicAmount(c).toString())throw new Error("Invalid amount: "+h.amt)}):a.forEach(function(e){if(""!==(null==e?void 0:e.cosigner)&&(null==e?void 0:e.cosigner)!==o.approver)throw new Error("Invalid or missing cosigner")}),!0}var i=n.mneeConfig;return i?o(i):Promise.resolve(n.getConfig()).then(o)},function(e){return console.error(e),!1}))}catch(e){return Promise.reject(e)}},t.getMneeSyncs=function(e,r,t){void 0===r&&(r=0),void 0===t&&(t=100);try{var n=this;return Promise.resolve(w(function(){return Promise.resolve(fetch(n.mneeApi+"/v1/sync?auth_token="+n.mneeApiToken+"&from="+r+"&limit="+t,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify([e])})).then(function(e){if(!e.ok)throw new Error("HTTP error! status: "+e.status);return Promise.resolve(e.json())})},function(e){console.error("Failed to fetch config:",e)}))}catch(e){return Promise.reject(e)}},t.getRecentTxHistory=function(e,r,t){try{var n=this;return Promise.resolve(w(function(){function o(o){if(!o)throw new Error("Config not fetched");return Promise.resolve(n.getMneeSyncs(e,r,t)).then(function(n){if(!n||0===n.length)return{history:[],nextScore:r||0};for(var i,s=[],u=h(n);!(i=u()).done;){var a=g(i.value,e,o);a&&s.push(a)}var c=s.sort(function(e,r){return r.height-e.height}).sort(function(e,r){return"unconfirmed"===e.status?-1:1});return 0===c.length?{history:[],nextScore:r||0}:t&&c.length>t?{history:c.slice(0,t),nextScore:c[t-1].score}:{history:c,nextScore:s[s.length-1].score}})}var i=n.mneeConfig;return i?o(i):Promise.resolve(n.getConfig()).then(o)},function(e){return console.error("Failed to fetch tx history:",e),{history:[],nextScore:r||0}}))}catch(e){return Promise.reject(e)}},t.parseTx=function(r){try{var t=function(t){if(!t)throw new Error("Config not fetched");return Promise.resolve(n.fetchBeef(r)).then(function(o){function i(){for(var t,o=h(s);!(t=o()).done;){var i,u=t.value,g=m([u])[0],w=v(u),P=null==w||null==(i=w.file)?void 0:i.content;if(P){var y=e.toUTF8(P);if(y){var I=JSON.parse(y);I&&("burn"===I.op&&(p="burn"),"deploy+mint"===I.op&&(p="deploy"),I.id===n.prodTokenId&&g.cosigner===n.prodApprover||(l=""===g.cosigner&&g.address===n.prodAddress?"prod":"test"),d+=BigInt(I.amt),c.push({address:g.address,amount:parseInt(I.amt)}))}}}if("deploy"!==p&&f!==d)throw new Error("Inputs and outputs are not equal");return r===n.prodTokenId.split("_")[0]?l="prod":[n.devTokenId,n.qaTokenId,n.stageTokenId].some(function(e){return r===e.split("_")[0]})&&(l="test"),{txid:r,environment:l,type:p,inputs:a,outputs:c}}if(!o)throw new Error("Failed to fetch transaction");var s=o.outputs.map(function(e){return e.lockingScript}),u=o.inputs.map(function(e){return{txid:e.sourceTXID,vout:e.sourceOutputIndex}}),a=[],c=[],f=0n,d=0n,l="prod",p="transfer",g=T(u,function(o){if(o.txid)return Promise.resolve(n.fetchBeef(o.txid)).then(function(i){var s,u=i.outputs[o.vout],c=m([u.lockingScript])[0];(null==c?void 0:c.address)===t.mintAddress&&(p=r===t.tokenId.split("_")[0]?"deploy":"mint");var d=v(u.lockingScript),h=null==d||null==(s=d.file)?void 0:s.content;if(h){var g=e.toUTF8(h);if(g){var w=JSON.parse(g);if(w){var P=c.address===n.prodAddress;w.id===n.prodTokenId&&c.cosigner===n.prodApprover||(""===c.cosigner&&"deploy+mint"===w.op&&P?(l="prod",p="mint"):l="test"),"transfer"===p&&(P||c.address===n.devAddress||c.address===n.qaAddress||c.address===n.stageAddress)&&(p="mint"),f+=BigInt(w.amt),a.push({address:c.address,amount:parseInt(w.amt)})}}}})});return g&&g.then?g.then(i):i()})},n=this,o=n.mneeConfig;return Promise.resolve(o?t(o):Promise.resolve(n.getConfig()).then(t))}catch(e){return Promise.reject(e)}},r}(),b=/*#__PURE__*/function(){function e(e){this.service=void 0,this.service=new S(e)}var r=e.prototype;return r.validateMneeTx=function(e,r){try{return Promise.resolve(this.service.validateMneeTx(e,r))}catch(e){return Promise.reject(e)}},r.toAtomicAmount=function(e){return this.service.toAtomicAmount(e)},r.fromAtomicAmount=function(e){return this.service.fromAtomicAmount(e)},r.config=function(){try{return Promise.resolve(this.service.getConfig())}catch(e){return Promise.reject(e)}},r.balance=function(e){try{return Promise.resolve(this.service.getBalance(e))}catch(e){return Promise.reject(e)}},r.transfer=function(e,r){try{return Promise.resolve(this.service.transfer(e,r))}catch(e){return Promise.reject(e)}},r.recentTxHistory=function(e,r,t){try{return Promise.resolve(this.service.getRecentTxHistory(e,r,t))}catch(e){return Promise.reject(e)}},r.parseTx=function(e){try{return Promise.resolve(this.service.parseTx(e))}catch(e){return Promise.reject(e)}},e}();export{b as default};
//# sourceMappingURL=index.module.js.map
