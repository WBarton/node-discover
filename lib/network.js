const crypto = require('node:crypto')
const dgram = require('node:dgram')
const os = require('node:os')
const EventEmitter = require('node:events').EventEmitter
const util = require('node:util')
const uuid = require('uuid').v4

let procUuid = uuid()
let hostName = process.env.DISCOVERY_HOSTNAME || os.hostname()

module.exports = Network

/**
 *
 *
 * @param {*} options
 * @returns
 */
function Network(options = {}) {
  if (!(this instanceof Network)) {
    return new Network(options, callback)
  }

  EventEmitter.call(this)

  let self = this

  self.address = options.address || '0.0.0.0'
  self.port = options.port || 12345
  self.broadcast = options.broadcast || null
  self.multicast = options.multicast || null
  self.multicastTTL = options.multicastTTL || 1
  self.unicast = options.unicast || null
  self.key = options.key || null
  self.exclusive = options.exclusive || false
  self.reuseAddr = options.reuseAddr !== false
  self.ignoreProcess = options.ignoreProcess !== false
  self.ignoreInstance = options.ignoreInstance !== false
  self.hostName = options.hostname || options.hostName || hostName

  self.socket = dgram.createSocket({ type: 'udp4', reuseAddr: self.reuseAddr })

  self.instanceUuid = uuid()
  self.processUuid = procUuid

  self.socket.on('message', (data, rinfo) => {
    self.decode(data, (err, obj) => {
      if (err) {
        // most decode errors are because we tried
        // to decrypt a packet for which we do not
        // have the key

        // the only other possibility is that the
        // message was split across packet boundaries
        // and that is not handled

        // self.emit("error", err);
      }
      else if (obj.pid == procUuid && self.ignoreProcess && obj.iid !== self.instanceUuid) {
        return false
      }
      else if (obj.iid == self.instanceUuid && self.ignoreInstance) {
        return false
      }
      else if (obj.event && obj.data) {
        self.emit(obj.event, obj.data, obj, rinfo)
      }
      else {
        self.emit('message', obj)
      }
    })
  })

  self.on('error', (err) => {
    // TODO: Deal with this
    /* console.log("Network error: ", err.stack); */
  })
};

util.inherits(Network, EventEmitter)

/**
 *
 *
 * @param {*} callback
 */
Network.prototype.start = function (callback) {
  let self = this

  let bindOpts = {
    port: self.port,
    address: '0.0.0.0',
    exclusive: self.exclusive,
  }

  self.socket.bind(bindOpts, () => {
    self.socket.setBroadcast(true)

    // TODO: get the default broadcast address from os.networkInterfaces() (not currently returned)
    self.destination = [self.broadcast || '255.255.255.255']

    // make sure each destination is a Destination instance
    self.destination.forEach((destination, i) => {
      self.destination[i] = Destination(destination)
    })

    return callback && callback()
  })
}

/**
 *
 *
 * @param {*} callback
 * @returns
 */
Network.prototype.stop = function (callback) {
  let self = this

  self.socket.close()

  return callback && callback()
}

/**
 *
 *
 * @param {*} event
 */
Network.prototype.send = function (event) {
  let self = this

  let obj = {
    event,
    pid: procUuid,
    iid: self.instanceUuid,
    hostName: self.hostName,
  }

  if (arguments.length == 2) {
    obj.data = arguments[1]
  }
  else {
    // TODO: splice the arguments array and remove the first element
    // setting data to the result array
  }

  self.encode(obj, (err, contents) => {
    if (err) {
      return false
    }

    let msg = Buffer.from(contents)

    self.destination.forEach((destination) => {
      self.socket.send(
        msg,
        0,
        msg.length,
        destination.port || self.port,
        destination.address,
      )
    })
  })
}

/**
 *
 *
 * @param {*} data
 * @param {*} callback
 * @returns
 */
Network.prototype.encode = function (data, callback) {
  let self = this
  let tmp

  try {
    tmp = (self.key)
      ? encrypt(JSON.stringify(data), self.key)
      : JSON.stringify(data)
  }
  catch (e) {
    return callback(e, null)
  }

  return callback(null, tmp)
}

/**
 *
 *
 * @param {*} data
 * @param {*} callback
 * @returns
 */
Network.prototype.decode = function (data, callback) {
  let self = this
  let tmp

  try {
    if (self.key) {
      tmp = JSON.parse(decrypt(data.toString(), self.key))
    }
    else {
      tmp = JSON.parse(data)
    }
  }
  catch (e) {
    return callback(e, null)
  }

  return callback(null, tmp)
}

/**
 *
 * @param {string} password
 * @returns {{key:Buffer, iv:Buffer}}
 */
function evpBytesToKey(password) {
  const keySize = 32
  const ivSize = 16
  const totalLen = keySize + ivSize
  const bytes = Buffer.alloc(totalLen)
  let hash = null
  let nBytes = 0

  while (nBytes < totalLen) {
    const md5 = crypto.createHash('md5')
    if (hash)
      md5.update(hash)
    md5.update(Buffer.from(password, 'binary')) // same encoding OpenSSL uses
    hash = md5.digest()
    hash.copy(bytes, nBytes)
    nBytes += hash.length
  }

  return {
    key: bytes.subarray(0, keySize),
    iv: bytes.subarray(keySize, totalLen),
  }
}

/**
 * @param {string} data
 * @param {string} password
 * @returns {string} decrypted
 */
function decrypt(data, password) {
  const { key, iv } = evpBytesToKey(password)
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)

  let decrypted = decipher.update(data, 'binary', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

/**
 * @param {string} data
 * @param {string} password
 * @returns {string} encrypted
 */
function encrypt(data, password) {
  const { key, iv } = evpBytesToKey(password)
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)

  let encrypted = cipher.update(data, 'utf8', 'binary')
  encrypted += cipher.final('binary')
  return encrypted
}

/**
 *
 *
 * @param {*} address
 * @param {*} port
 * @returns
 */
function Destination(address, port) {
  if (!(this instanceof Destination)) {
    return new Destination(address, port)
  }

  if (!port && ~address.indexOf(':')) {
    let tokens = address.split(':')
    address = tokens[0]
    port = tokens[1]
  }

  this.address = address
  this.port = port
}
