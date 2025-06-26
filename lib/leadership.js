module.exports = resolveLeadership
module.exports.BasicLeadershipElection = BasicLeadershipElection

/**
 * Resolve the leadershipElector for the discover instance
 *
 * @param {*} discover the discover instance from which events will be bound to LeadershipElection instance methods
 * @returns {BasicLeadershipElection} the instance of the LeadershipElection module that was resolved or false
 */
function resolveLeadership(discover) {
  const elector = new BasicLeadershipElection(discover)

  discover.on('started', elector.start.bind(elector))
  discover.on('stopped', elector.stop.bind(elector))

  discover.on('added', elector.onNodeAdded.bind(elector))
  discover.on('removed', elector.onNodeRemoved.bind(elector))
  discover.on('helloReceived', elector.helloReceived.bind(elector))
  discover.on('master', elector.onMasterAdded.bind(elector))
  discover.on('check', elector.check.bind(elector))

  return elector
}

/**
 * Simple default leadership election.
 * @constructor
 */
function BasicLeadershipElection(discover) {
  let self = this

  self.discover = discover
}

BasicLeadershipElection.prototype.onNodeAdded = function (node, obj, rinfo) {
}

BasicLeadershipElection.prototype.onNodeRemoved = function (node) {
}

BasicLeadershipElection.prototype.onMasterAdded = function (node, obj, rinfo) {
}

BasicLeadershipElection.prototype.helloReceived = function (node, obj, rinfo, isNew, wasMaster) {
}

BasicLeadershipElection.prototype.check = function () {
  let mastersFound = 0
  let higherWeightMasters = 0
  let higherWeightFound = false
  const discover = this.discover
  const settings = discover.settings

  const me = discover.me
  for (const processUuid in discover.nodes) {
    if (!Object.prototype.hasOwnProperty.call(discover.nodes, processUuid)) {
      continue
    }
    const node = discover.nodes[processUuid]

    if (node.isMaster && (+new Date() - node.lastSeen) < settings.masterTimeout) {
      mastersFound++
      if (node.weight > me.weight) {
        higherWeightMasters += 1
      }
    }

    if (node.weight > me.weight && node.isMasterEligible && !node.isMaster) {
      higherWeightFound = true
    }
  }

  if (me.isMaster && higherWeightMasters >= settings.mastersRequired) {
    discover.demote()
  }

  if (!me.isMaster && mastersFound < settings.mastersRequired && me.isMasterEligible && !higherWeightFound) {
    // no masters found out of all our nodes, become one.
    discover.promote()
  }
}

BasicLeadershipElection.prototype.start = function (discover) {
  this.discover = discover
}

BasicLeadershipElection.prototype.stop = function () {
}
