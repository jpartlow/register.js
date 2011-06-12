/* This file is part of register.js.  Copyright 2011 Joshua Partlow.  This program is free software, licensed under the terms of the GNU General Public License.  Please see the LICENSE file in this distribution for more information, or see http://www.gnu.org/copyleft/gpl.html. */

var Register = {
  version: '0.1.4',
  debug: false,
  registers: $H(),

  // Create and initialize a new Register.Instance from config and store it in
  // the Register.registers hash.
  create: function(config) {
    var register = new Register.Instance(config).initialize()
    this.registers.set(register.id(), register)
    return register
  },

  // Create and initialize a new Register.Instance from config and update
  // container_element with its root element.
  create_and_update: function(config, container_element) {
    var register = this.create(config)
    container_element.update(register.root())
    register.ui.purchase_amount_input.focus()
    return register
  },

  // Update the register identified by id.
  // (used to provide error information if server fails to post)
  update: function(id, changes) {
    var register = this.registers.get(id)
    register.set_errors(changes)
  },

  // Make an Ajax request for register configuration.
  //
  // * href: url to request register configuration from via Ajax.
  // * update: element to be updated with the new register
  // * config: an object with additional configuration
  //   * ajax: overrides to Prototype Ajax.Request settings.
  //   * register: initial Registration.Instance configuration
  //   to be added to configuration returned from the Ajax call.
  request_register: function(href, update, config) {
    config = $H(config || {})
    ajax_overrides = config.unset('ajax') || {}
    base_register_config = config.unset('register') || {}
    var ajax_config = $H({
      method: 'get', 
      onSuccess: function(response) {
        var config = $H(base_register_config).merge(response.responseJSON)
        return Register.create_and_update(config.toObject(), update) 
      },
      onFailure: function(response) { 
        alert("Failed to initialize register: " + response.status + ":" + response.statusText +
          "\n\n" + response.responseText)
      },
      onException: function(request, exception) {
        alert("Failed to initialize register.  Threw: " + exception)
      },
      onComplete: this.hide_spinner,
    }).merge(ajax_overrides)
    this.show_spinner()
    new Ajax.Request(href, ajax_config.toObject())
  },

  // Remove the given Register.Instance from the Register.registers hash
  // and delete it.
  destroy: function(instance) {
    if (instance.root()) { instance.root().remove() }
    this.registers.unset(instance.id())
  },

  // Override with a local function to show a work in progress graphic.
  show_spinner: null,

  // Override with a local function to hide a work in progress graphic.
  hide_spinner: null,
}

/////////////////////
/* Register.Events */
/////////////////////

Register.Events = {
  // Call this  to provide a new object cloned from Register.Events.Methods with
  // whatever events were passed as arguments pre initialized.  An interested
  // object may then extend this, or delegate to it, in order to have event handling.
  //
  // Foo = function() { // my foo constructor }
  // Object.extend(Foo, Register.Events.handler_for('update', 'freak_out'))
  // f = new Foo()
  // f.add_listener('freak_out', listening_instance.freak_out_callback_handler)
  // f.fire('freak_out')
  // // (listening_instance.freak_out_callback_handler is called...)
  //
  handler_for: function() {
    var event_handler = Object.clone(Register.Events.Methods)
    event_handler.__events__ = $A(arguments)
    return event_handler
  }, 
}
// Event handling code to be mixed into any type which wants to allow other objects
// to listen for events that it broadcasts.
Register.Events.Methods = {

  _initialize_events: function() {
    this.__listeners__ = $H({})
    $A(this.__events__).each(function(a) { 
      this.__listeners__.set(a, $A([]))
    }, this)
  },

  _listeners: function() {
    if (Object.isUndefined(this.__listeners__)) {
      this._initialize_events()
    }
    return this.__listeners__
  },

  _get_callbacks: function(event) {
    var callbacks = this._listeners().get(event)
    if (!callbacks) { throw(new Register.Exceptions.EventException('_get_callbacks', "Requested callback for unknown event '#{event}'", { event: event })) }
    return callbacks
  },

  add_listener: function(event, callback) {
    return this._get_callbacks(event).push(callback)
    return this
  },

  fire: function(event) {
    this._get_callbacks(event).each(function(callback) {
      callback(this) 
    }, this)
    return true
  },

}

///////////////////
/* Register.Core */
///////////////////

// Methods available to all Register.<Object> instances.
Register.Core = function() {
}
Register.Core.prototype = {
  // Given a constructor method, maps an array of configuration data into an
  // array of constructor instances.
  //
  // The returned Prototype Array is extended with a lookup() function to assist
  // with finding elements by their 'id' property.
  initialize_array_of: function(element_function, config_array, config_overrides) {
    var array = $A(config_array).map(function(config) { 
      return new element_function.prototype.constructor(config, config_overrides) 
    })
    Object.extend(array, {
      lookup: function(key) {
        if (Object.isUndefined(this.__index)) {
          this.index = this.inject($H(), function(hash, e) {
            hash.set(e.id, e)
            return hash
          })
        }
        return this.index.get(key)
      },
    })
    return array
  },

  alert_user: function(message) {
    if (Register.debug) {
      this.last_alert = message
      this.log(message)
    } else {
      alert(message)
    }
  },

  log: function(message) {
    if (typeof console !== 'undefined') {
      console.log("Register: " + message)
    }
  },

  // Present a number as a dollar amount string with two decimal places.
  // If amount is not a number or a string which can be parsed as a number,
  // amount will be returned as is.
  // Default is without dollar sign.
  // monetize(45)         => '45.00'
  // monetize(34.0, true) => '$34.00'
  // monetize('.12')      => '0.12'
  // monetize('foo')      => 'foo'
  // monetize('')         => '' 
  // monetize(null)       => null
  // monetize(undefined)  => null
  monetize: function(input, dollar_sign) {
    var amount = parseFloat(input) 
    if (isNaN(amount)) {
      return input
    }
    var decimal = amount.toFixed(2)
    return (dollar_sign ? '$' : '') + decimal 
  },

  // Locate by an id string or selector string, in the Document, or in passed
  // element.  This method should be used for locating required elements in the
  // register's html template.
  //
  // locate('foo') // finds #foo in current context or Document
  // locate('.bar') // finds first .bar in current context or Document
  //
  // Note that because a bar string is being interpreted as an id string, you cannot
  // locate the first element of a given type.  locate('div') will search for '#div'.
  // Since the point of this function is only to lookup uniquely id'd or classed
  // elements within a given context, this shouldn't matter.
  //
  // If this object has a this.root property pointing to an Element, then it
  // will be used as a default context instead of the Document if no context is
  // given.
  //
  // Throws Register.Exceptions.MissingElementException if not found unless
  // loudly is set false.
  locate: function(selector, context, loudly) {
    var quietly = loudly === false ? true : false
    context = context || (this.root instanceof Element ? this.root : null)
    var selector_is_an_id_string = selector.match(/^[\w\d_-]+$/) == null ? false : true
    var element
    if (selector_is_an_id_string) {
      element = (context ?
        context.down("#" + selector) :
        $(selector)
      )
    } else {
      element = (context ?
        context.down(selector) :
        $$(selector).first()
      )
    }
    if (Object.is_null_or_undefined(element) && !quietly) {
      throw( new Register.Exceptions.MissingElementException(selector, context) ) 
    } else if (element) {
      return element 
    }
    return undefined 
  },

  // Update an element's innerHTML from an array of elements and/or html strings.
  // Returns the element for chaining.
  update_from_array: function(element, array, sort) {
    element.update()
    var options = array
    if (sort) { options = options.sortBy(function(o) { return o.textContent }) }
    $A(options).each(function(e) {
      element.insert(e)
    })
    return element
  },
}

/////////////////////////
/* Register.Exceptions */
/////////////////////////

Register.Exceptions = {
  BaseException: function() {},

  generate_stack_trace: function() {
    var e = new Error()
    var stack = e.stack
    if (stack) {
      stack = stack.split("\n")
      stack.shift() // top two calls are from the new Error() point above
      stack.shift() 
      stack.shift() // third call is from the point where generate_stack_trace() was called
      stack = stack.join("\n")
    } else {
      stack = (e.fileName || '(Unknown)') + ":" + e.lineNumber
    }
    return stack
  },

  generate_exception_type: function(type) {
    var constructor = Register.Exceptions[type] = function(method, msg, macros) {
      macros = macros || {}
      this.name = type 
      this.message = this.name + "." + method + " failed.\n"
      this.stack = Register.Exceptions.generate_stack_trace() 
      if (msg) {
        this.message = this.message + msg.interpolate(macros) 
      }
    }
    constructor.prototype = new Register.Exceptions.BaseException()
    return constructor
  },

  MissingElementException: function(selector, element) {
    this.name = "MissingElementException"
    this.message = "Unable to find " + selector + " in " + element
    this.stack = Register.Exceptions.generate_stack_trace() 
  },
}
Register.Exceptions.BaseException.prototype = {
  toString: function() { return this.name + ":" + this.message },
}
Register.Exceptions.generate_exception_type('RegisterException')
Register.Exceptions.generate_exception_type('LedgerException')
Register.Exceptions.generate_exception_type('LedgerRowException')
Register.Exceptions.generate_exception_type('EventException')
Register.Exceptions.MissingElementException.prototype = new Register.Exceptions.BaseException()

///////////////////////
/* Register.Instance */
///////////////////////

// A Register.Instance is the primary handle for an active register.
//
// Expects to be passed a configuration Object with:
//
// * purchase_codes : Array of raw purchase Code data
// * payment_codes : Array of raw payment Code data
// * adjustment_codes : Array of raw adjustment Code data
// * credit_codes : Array of raw credit Code data
// * ledger : Array of raw LedgerRow data
// * payment : Object of raw Payment data
// * template : String representing the register template XHTML
//
Register.Instance = function(config) {
  this.config = config || {}
  this.purchase_codes = this.initialize_array_of(Register.PurchaseCode, this.config.purchase_codes)
  this.payment_codes = this.initialize_array_of(Register.PaymentCode, this.config.payment_codes)
  this.adjustment_codes = this.initialize_array_of(Register.AdjustmentCode, this.config.adjustment_codes)
  this.credit_codes = this.initialize_array_of(Register.CreditCode, this.config.credit_codes)
  this.__generate_code_index()
  this.ledger = new Register.Ledger(this, { rows: this.config.ledger })
  this.payment = new Register.Payment(this, this.config.payment)
  this.ui = new Register.UI(this, this.config.template)
  this.after_create = this.config.after_create
}
Register.Instance.inherits(Register.Core)
// Constants
Register.Instance.NEW_MARKER = "__new__"
// Methods
Object.extend(Register.Instance.prototype, {
  // Call this to prepare the instance for use.
  initialize: function() {
    this.ui.initialize()
    if (typeof this.after_create == 'function') { this.after_create() }
    return this
  },

  // Payment identifier for this register or Register.Instance.NEW_MARKER if
  // this is for a new payment.
  id: function() {
    return this.payment.id || Register.Instance.NEW_MARKER
  },

  // Extracts error info from returned data and updates UI.
  set_errors: function(errors) {
    this.payment_error = errors.payment_error
    this.validation_errors = errors.validation_errors
    this.ui.display_errors()
  },

  // True if instance is for a new payment.
  is_new: function() {
    return this.id() === Register.Instance.NEW_MARKER 
  },

  // Register's root element.
  root: function() {
    return this.ui.root
  },

  // Lookup a purchase, payment, or credit code by unique id.
  find_code: function(code_id) {
    return this.code_index.get(code_id)
  },

  // Lookup a purchase, payment, or credit code by the given field.
  // (results are indeterminate if lookup_field is not a unique key)
  find_code_by: function(lookup_field, value)  {
    return this.code_index.values().detect(function(c) {
      return c[lookup_field] == value
    }) 
  },

  // Facade for adding a purchase line item to the ledger and
  // ui.
  add_purchase: function(code_or_code_id, amount) {
    if (typeof code_or_code_id == 'string') {
      var code = this.find_code_by('code', code_or_code_id)
    }
    return this.ui.add_ledger_row((code ? code.id : code_or_code_id), amount)
  },

  // Facade for changing the payment code.  Sets the UI payment_codes_select.
  switch_payment_code_to: function(payment_type) {
    var payment_code = this.find_code_by('payment_type', payment_type)
    if (typeof payment_code == 'undefined') { 
      throw(new Register.Exception.RegisterException('switch_payment_code_to', 'No payment code found for payment_type: "#{payment_type}"', { payment_type: payment_type }))
    }
    this.ui.payment_codes_select.value = payment_code.id
    this.ui.handle_payment_code_select()
  },
  
  // Return the cash payment code which should be associated with change.
  // XXX This relies on the payment_type being 'Cash'
  change_code: function() {
    if (!this.__change_code) {
      this.__change_code = this.payment_codes.find(function(c) { return c.payment_type == 'Cash' })
    }
    return this.__change_code
  },

  // Register a callback method for a Register event.
  add_listener: function(event, callback) {
    this.ledger.add_listener(event, callback) 
  },

  // Override to hook into the Register's cancel cycle.
  on_cancel: function(event) { return true },

  cancel: function(event) {
    var success = false
    this.show_spinner()
    if (this.on_cancel(event)) {
      var href = event.findElement().href || '#'
      if (href.match(/#/)) {
        event.stop()
        Register.destroy(this)
        this.hide_spinner()
      }
      // otherwise let the page reload
      success = true
    }
    return success 
  },

  // Override to hook into the Register's submit cycle,
  on_submit: function(event, parameters) { return true },

  submit: function(event) {
    var success = false
    var parameters = this.parameterize()
    var id = this.id()
    this.show_spinner()
    if (this.on_submit(event, parameters)) {
      var href = this.ui.form.target || '#'
      var method = this.ui.form.method || 'post'
      if (!href.match(/^#/)) {
        new Ajax.Request(href, {
          method: method,
          parameters: parameters, 
          // invalid payment data
          on422: function(response) {
            Register.update(id, response.responseJSON)
            Register.hide_spinner()
          },
          // if successful redirect
          onSuccess: function(response) {
            window.location = response.responseJSON.location
          },
          // general server failure
          onFailure: function(response) {
            var json = response.responseJSON
            if (json) {
              alert("Payment failed: " + json.payment_error)
              Register.update(id, json)
            } else {
              alert("Server failure: " + response.status + ":" + response.statusText + "\n\n" + response.responseText)
            }
            Register.hide_spinner()
          },
          onException: function(request, exception) {
            alert("Failed to submit register.  Threw: " + exception)
            Register.hide_spinner()
          },
        })
      } else {
        this.hide_spinner()
      }
      success = true 
    }
    return success
  },

  // Return an object with properties for all of the ledger, payment and form data.
  serialize: function() {
    var serialized = this.ui.serialize()
    serialized['ledger_entries_attributes'] = this.ledger.serialize()
    return serialized
  },

  // Return an object with properties for all of the ledger, payment and form
  // data suitable for submission as form parameters (no nested objects).
  parameterize: function() {
    var parameterized =$H(this.serialize())
    var ledger_entries_attributes = parameterized.unset('ledger_entries_attributes')
    $A(ledger_entries_attributes).each(function(object,i) {
      for (attr in object) {
        parameterized.set('payment[ledger_entries_attributes][' + i + '][' + attr + ']', object[attr])
      } 
    })
    return parameterized.toObject()
  },

  // Show work in progress spinner if present.
  show_spinner: function() {
    if (typeof Register.show_spinner == 'function') { Register.show_spinner() }
  },

  // Hide work in progress spinner if present.
  hide_spinner: function() {
    if (typeof Register.hide_spinner == 'function') { Register.hide_spinner() }
  },

  // Creates a Hash to index all of the purchase/payment/credit codes by id.
  // Will throw a RegisterException if two codes have the same id.
  __generate_code_index: function() {
    this.code_index = $H()
    var codes = $A([this.purchase_codes, this.payment_codes, this.adjustment_codes, this.credit_codes]).flatten().compact()
    codes.inject(this.code_index, function(index, code) {
      index.set(code.id, code)
      return index  
    })
    if (codes.size() != this.code_index.size()) {
      throw(new Register.Exceptions.RegisterException('__generate_code_index', "Overlapping code ids."))
    }
    return this.code_index
  },
})

/////////////////////
/* Register.Code   */
/////////////////////

// A Register.Code represents one code that a user of the register would
// use to code a particular purchase, payment or credit line item.
Register.Code = function(config) {
  this.initialize(config)
}
// Methods
Register.Code.inherits(Register.Core)
Object.extend(Register.Code.prototype, {
  initialize: function(config) {
    this.config = config || {}
    var configure = function(field) {
      this[field] = this.config[field]
    }.bind(this)
    $A(['id', 'code', 'label', 'account_number', 'account_name', 'fee_types', 'account_type', 'debit_or_credit','payment_type', 'allows_change']).each(configure)
    return this
  },

  // XXX Relies on payment_type == 'Check'
  is_check: function() {
    return this.payment_type == 'Check'
  },

  // XXX Relies on payment_type == 'CreditCard'
  is_credit_card: function() {
    return this.payment_type == 'CreditCard'
  },

  toString: function() {
    return "[" + this.code + ":" + this.label + "]"
  },
})
// Subtypes
Register.PurchaseCode = function(config) {
  this.initialize(config)
}
Register.PurchaseCode.inherits(Register.Code)
Register.PaymentCode = function(config) { this.initialize(config) }
Register.PaymentCode.inherits(Register.Code)
Register.AdjustmentCode = function(config) { this.initialize(config) }
Register.AdjustmentCode.inherits(Register.Code)
Register.CreditCode = function(config) { this.initialize(config) }
Register.CreditCode.inherits(Register.Code)
