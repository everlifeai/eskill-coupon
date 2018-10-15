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

/*      outcome/
 * Load the wallet account from the stellar microservice
 */
let account
function getWalletAccount() {
    const stellarClient = new cote.Requester({
        name: 'elife-coupon -> Stellar',
        key: 'everlife-stellar-svc',
    })

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

        let rx = /^\/coupon *(.*)/
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
                    sendReply(`error : ${error}`, req)
                } else if(response && response.statusCode != 200) {
                    sendReply(`error : ${response}`, req)
                } else {
                    sendReply(`Account "${account}" activated!`, req)
                }
            });
        } else cb()
    })
}

main()
