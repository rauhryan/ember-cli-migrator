var recast = require('recast');
var namedTypes = recast.types.namedTypes;
var builders = recast.types.builders;
var Visitor = recast.Visitor;

// Helper function to extract global namespace name from a member expression node
function extractMemberExpressionInfo(node) {
  var info = {};
  if (node.object.object) {
    // Need to check member expressions of the type Ember.ObjectController.extend
    info.namespace = node.object.object.name;
    info.property = node.object.property.name;
  } else if (node.object) {
    // Need to check member expressions of the type App.FunMixin
    info.namespace = node.object.name;
    info.property = node.property.name;
  }
  return info;
}

// The primary purpose of the process visitor is to find the set of all imports we need
// to construct the output file
var MigratorVisitor = Visitor.extend({
  init: function(options) {
    this.rootAppName = options.rootAppName;
    this.classesFilepathMap = options.classesFilepathMap;
    // This is what we will construct our import strings from
    this.imports = {};
  },

  visitMemberExpression: function(node){
    // Check all member expressions, e.g., object.name, in order to find imports we need
    if (namedTypes.MemberExpression.check(node)) {
      var info = extractMemberExpressionInfo(node);
      if ((info.namespace === "Ember" || info.namespace === "Em")){
        // We are using Ember or Em namespace so import Ember
        this.imports.Ember = 'Ember';
      } else if (info.namespace === "DS") {
        // We are using DS namespace so import ember-data
        this.imports.DS = 'ember-data';
      } else if (info.namespace === this.rootAppName){
        // We are using the global App namespace so we need to import something from our ember-cli structure
        var name = info.property;
        if (this.classesFilepathMap[name] && this.classesFilepathMap[name].moduleName) {
          this.imports[name] = this.classesFilepathMap[name].moduleName;
        } else {
          console.log("Do not know how to import", info.namespace);
        }
      }
    }
    return node;
  },

  // The secondary purpose of this visitor is to replace the app assignment with a var assignment so that
  // we are ready to export the var rather than use globals
  visitAssignmentExpression: function(node){
    var leftNode = node.left;
    var rightNode = node.right;
    if (namedTypes.MemberExpression.check(node.left) &&
        (leftNode.object.name === this.rootAppName ||
         leftNode.object.name === 'window') ){
      this._exportName = leftNode.property.name;
      var newNode = builders.variableDeclaration("var", [builders.variableDeclarator(builders.identifier(leftNode.property.name), rightNode)]);
      // Recursively check this node to see if it is a member expression and we need an import
      this.genericVisit(newNode);
      return newNode;
    }
    return node;
  }
});

module.exports = MigratorVisitor;
