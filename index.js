'use strict'
const cote = require('cote')({statusLogsEnabled:false})
const request = require('request')
const u = require('elife-utils')

/*      understand/
 * This is the main entry point where we start.
 *
 *      outcome/
 * Start our microservice and register with the communication manager
 * and get the wallet account.
 */
function main() {
    startMicroservice()
    registerWithCommMgr()
    getWalletAccount()
}

const commMgrClient = new cote.Requester({
    name: 'elife-coupon -> CommMgr',
    key: 'everlife-communication-svc',
})

function sendReply(msg, req) {
    req.type = 'reply'
    req.msg = msg
    commMgrClient.send(req, (err) => {
        if(err) u.showErr(err)
    })
}

let msKey = 'everlife-coupon'
function registerWithCommMgr() {
    commMgrClient.send({
        type: 'register-msg-handler',
        mskey: msKey,
        mstype: 'msg',
    }, (err) => {
        if(err) u.showErr(err)
    })
}

const stellarClient = new cote.Requester({
    name: 'elife-coupon -> Stellar',
    key: 'everlife-stellar-svc',
})

/*      outcome/
 * Load the wallet account from the stellar microservice
 */
let account
function getWalletAccount() {
    stellarClient.send({
        type: 'account-id',
    }, (err, acc_) => {
        if(err) u.showErr(err)
        else account = acc_
    })
}

function startMicroservice() {

    /*      understand/
     * The microservice (partitioned by key to prevent
     * conflicting with other services.
     */
    const svc = new cote.Responder({
        name: 'Everlife Coupon Service',
        key: msKey,
    })

    svc.on('msg', (req, cb) => {
        if(!req.msg) return cb()

        let rx = /^use coupon *(.*)/
        let m = req.msg.match(rx)
        if(m) {
            cb(null, true)
            sendReply(`Redeeming coupon...`, req)
            let coupon = m[1]

            let uri = `http://${process.env.SSB_HOST}:3000/coupons/${coupon}/${account}`

            const options ={
                "uri":      uri,
                "method":   "DELETE",
            }
            request(options, function(err, response, body){
                if(err) {
                    u.showErr(err)
                    sendReply(`Error connecting to marketplace!`, req)
                } else if(response && response.statusCode != 200) {
                    sendReply(`Coupon Error!`, req)
                } else {
                    sendReply(`Account "${account}" activated!`, req)
                    sendReply(`Setting up EVER trustline...`, req)
                    stellarClient.send({
                        type: 'setup-ever-trustline',
                    }, (err, acc_) => {
                        if(err) {
                            u.showErr(err)
                            sendReply(`Error setting up trustline!`, req)
                        } else {
                            sendReply(`Account activated and EVER trustline set! You can now accept payment on "${account}"`, req)
                        }
                    })
                }
            });
        } else cb()
    })
}

main()
