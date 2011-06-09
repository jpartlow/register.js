/* This file is part of register.js.  Copyright 2011 Joshua Partlow.  This program is free software, licensed under the terms of the GNU General Public License.  Please see the LICENSE file in this distribution for more information, or see http://www.gnu.org/copyleft/gpl.html. */

var Register = {
  version: '0.1.1',
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
      if (!href.match(/^#/)) {
        new Ajax.Request(href, {
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


//////////////////////
/* Register.Payment */
//////////////////////

// General information about the payment.
Register.Payment = function(register, config) {
  this.register = register
  this.initialize(config)
}
Register.Payment.inherits(Register.Core)
Object.extend(Register.Payment.prototype, {
  initialize: function(config) {
    this.config = config || {}
    this.fields = $A([])
    var prop
    for (prop in config) {
      this.fields.push(prop)
      this[prop] = config[prop]
    }
    this.new = this.id ? false : true
  }

  // Returns true if this is a new payment that has not been saved
  // server side yet.  Otherwise we are making an update to an existing
  // payment.
  is_new: function() {
    return this.new
  }
})

/////////////////////
/* Register.Ledger */
/////////////////////

// The Register.Ledger is the collection of all ledger entries which
// together will make up the accounting transaction being processed by this
// payment.
Register.Ledger = function(register, config) {
  this.register = register
  this.config = config || {}
  this.rows = $A()
  $A(this.config.rows || []).each(function(row_config) { this.add(row_config) }, this)
}
Register.Ledger.inherits(Register.Core)
Object.extend(Register.Ledger.prototype, Register.Events.handler_for('update'))
Object.extend(Register.Ledger.prototype, {
  // Number of ledger entries.
  count: function(old_or_new) {
    return this.get_rows(old_or_new).length
  },

  // Add a new LedgerRow for the given type, code and amount.
  // Throws Register.Exceptions.LedgerException if cannot determine a code from code_id.
  // Alternately, if passed a single object, it assumes it is a configuration object
  // for an existing LedgerRow and tries to instantiate from it.
  add: function(type, code_id, amount) {
    var new_row
    if (arguments.length == 1 && typeof(arguments[0]) == "object") {
      new_row = new Register.LedgerRow(arguments[0]) 
    } else {
      var code = this.register.find_code(code_id)
      if (!code) { throw(new Register.Exceptions.LedgerException('add', 'Cannot add a new row to the Ledger without a Register.Code')) }
  
      var debit, credit
      switch (code.debit_or_credit) {
        case 'D': debit = amount; break
        case 'C': credit = amount; break
        default: throw(new Register.Exceptions.LedgerException('add', "Register.Code.debit_or_credit of unknown type: '#{type}'", { type: code.debit_or_credit }))
      }
      var new_row = new Register.LedgerRow({
        code_type: type,
        code: code,
        debit: debit,
        credit: credit,
      })
    }
    this.rows.push(new_row)
    if (new_row.is_new()) {
      // Registers a remove call with the row's 'destroy' listener so that we remove
      // the row from the ledger array when it is destroyed.
      new_row.add_listener('destroy', this.remove.bind(this))
      if (new_row.is_purchase()) { 
        new_row.add_listener('update', this.update.bind(this))
      }
    }
    // update ledger totals and notify listeners.
    this.update()
    return new_row
  },

  // Add a purchase LedgerRow.
  add_purchase: function(code_id, amount) { 
    return this.add(Register.LedgerRow.PURCHASE_TYPE, code_id, amount)
  },

  // Removes the given row from the ledger.
  remove: function(row) {
    this.rows.remove(this.rows.indexOf(row)) 
    if (row.is_purchase()) {
      this.update()
    }
  },

  // Returns amount tendered by the customer, if it has been set, or the 
  // current new purchase total.
  get_amount_tendered_or_credited: function() {
    return this._amount_tendered || this.get_purchase_total('new')
  },

  // Can be set to override the amount the customer is actually paying,
  // typically if they pay with more cash than the purchase total and are
  // therefore due change.
  set_amount_tendered: function(tendered) {
    var amount_tendered = parseFloat(tendered)
    this._amount_tendered = isNaN(amount_tendered) ? undefined : amount_tendered
    this.update()
    return this
  },

  // Sets the payment Register.Code, resets the associated new payment
  // Ledger.Row and returns it.
  set_payment_code: function(code_or_code_id) {
    var new_code = code_or_code_id
    if (!(code_or_code_id instanceof Register.Code)) {
      new_code = this.register.payment_codes.lookup(code_or_code_id)
    }
    if (this.payment_code != new_code) {
      this.__reset_payment(new_code)
    }
    return this.payment_row()
  },

  // Recalculates the change row value based on current purchase total less payment.
  recalculate_change: function() {
    var change = this.get_payment_total('new') - this.get_purchase_total('new')
    if (change == 0) {
      this.__destroy_change()
    } else {
      if (!this.change_row()) {
        if (this.payment_code) {
          // add (-1 * change) because we are returning Cash, but the code is for payment
          // and defaults to debit, so we need to flip it to credit
          this.add(Register.LedgerRow.CHANGE_TYPE, this.register.change_code().id, -1 * change)
        }
      } else {
        this.change_row().set_credit(change)
      }
    }
    return change
  },

  // Recalculates the payment row value based on current purchase total, or
  // amount_tendered if that has been set.
  recalculate_payment: function() {
    var payment = this.get_amount_tendered_or_credited()
    if (payment == 0) {
      this.__destroy_payment()
    } else {
      if (!this.payment_row()) {
        if (this.payment_code && !(this.payment_code instanceof Register.AdjustmentCode)) {
          this.add(Register.LedgerRow.PAYMENT_TYPE, this.payment_code.id, payment)
        }
      } else {
        this.payment_row().set_debit(payment)
      }
    }
  },

  // Update the ledger totals and fire the update event to notify listening objects
  // like the UI.
  update: function() {
    try {
      if (!this.__updating__) {
          this.__updating__ = true
          this.recalculate_payment()
          this.recalculate_change()
          this.fire('update')
      }
    } finally {
      this.__updating__ = false
    }
    return true
  },

  // (Re)initializes a new payment row.
  __reset_payment: function(new_code) {
    this.__destroy_payment() 
    this.payment_code = new_code
    this.update()
    return true
  },

  __destroy_payment: function() {
    if (this.payment_row()) { this.payment_row().destroy() }
  },

  __destroy_change: function() {
    if (this.change_row()) { this.change_row().destroy() }
  },

  __rows_by_type: function(code_type, config) {
    config = config || {}
    var old_or_new = config['old_or_new']
    return this.rows.select(function(e) { 
      return (code_type == 'all' ? true : e.code_type == code_type) && (
        old_or_new == 'new' ?
          e.is_new() :
          old_or_new == 'old' ?
            !e.is_new() :
            true // either old or new
      )
    })
  },

  // Get all ledger rows, old or new or both.
  get_rows: function(old_or_new) {
    return this.__rows_by_type('all', { old_or_new: old_or_new })
  },

  // Get the purchase rows, both old and new.
  // If you pass 'old' you will get only the old saved rows, if any.
  // If you pass 'new' you will get only the new unsaved rows.
  // The default is both.
  purchase_rows: function(old_or_new) {
    return this.__rows_by_type(Register.LedgerRow.PURCHASE_TYPE, { old_or_new: old_or_new })
  },

  // Get the payment rows, both old and new.
  // Same options as purchase_rows.
  payment_rows: function(old_or_new) {
    return this.__rows_by_type(Register.LedgerRow.PAYMENT_TYPE, { old_or_new: old_or_new })
  },

  // Return the new payment row, if there is one.
  payment_row: function() {
    return this.payment_rows('new').first()
  },

  // Get the change rows, both old and new
  // Same options as purchase_rows.
  change_rows: function(old_or_new) {
    return this.__rows_by_type(Register.LedgerRow.CHANGE_TYPE, { old_or_new: old_or_new })
  },

  // Return the new change row, if there is one.
  change_row: function() {
    return this.change_rows('new').first()
  },

  // Total value of purchase ledger entries.
  // Same options as purchase_rows.
  get_purchase_total: function(old_or_new) {
    return this.purchase_rows(old_or_new).sum('get_credit_or_debit') || 0
  },

  // Total value of payment ledger entries.
  get_payment_total: function(old_or_new) {
    return this.payment_rows(old_or_new).sum('get_debit_or_credit') || 0
  },

  // Get the total amount tendered by the customer.
  // (This will always be positive)
  get_tendered_total: function(old_or_new) {
    return this.payment_rows(old_or_new).sum('get_debit') || 0
  },

  // Get the total amount credited back to the customer.
  // (This will always be positive)
  get_credited_total: function(old_or_new) {
    return this.payment_rows(old_or_new).sum('get_credit') || 0
  },

  // Get the change owed to the customer.
  get_change_total: function(old_or_new) {
    return this.change_rows(old_or_new).sum('get_credit_or_debit') || 0
  },

  // Get the total register debits.
  get_debits_total: function(old_or_new) {
    return this.__rows_by_type('all', { old_or_new: old_or_new }).sum('get_debit') || 0
  },

  // Get the total register credits.
  get_credits_total: function(old_or_new) {
    return this.__rows_by_type('all', { old_or_new: old_or_new }).sum('get_credit') || 0
  },

  // Serialize all of the new ledger row data as an array of objects.
  serialize: function() {
    return this.__rows_by_type('all', { old_or_new: 'new' }).map(function(r) { 
      return r.serialize()
    }).toArray()
  },

  // Checks that register is in a valid state.
  // * debits and credits must balance
  // * change cannot be negative
  // * amount tendered must be positive for payment
  // * amount credited must be positive for credit
  // * payment and change must be zero for adjustment
  // * unless we are cashing a check, there must be ledger rows
  // * enabled required fields should be present
  validate: function() {
    this.errors = $A([])
    var debits = this.get_debits_total('new')
    var credits = this.get_credits_total('new')
    var tendered = this.get_tendered_total('new')
    var credited = this.get_credited_total('new')
    var change = this.get_change_total('new')
    if ( change < 0 ) {
      this.errors.push('you may not return negative change...')
    }
    if (this.payment_code instanceof Register.PaymentCode) {
      if (tendered <= 0) {
        this.errors.push('amount tendered must be positive for a payment')
      }
    } else if (this.payment_code instanceof Register.AdjustmentCode) {
      if ([tendered, credited, change].any(function(e) { return e != 0 })) {
        this.errors.push('payment and change must both be zero if you are adjusting internal accounts')
      }
    } else if (this.credit_code instanceof Register.CreditCode) {
      if (credited <= 0) {
        this.errors.push('amount credited must be positive for a credit')
      }
    }
    if (debits != credits) {
      this.errors.push('debits and credits do not balance (debits must equal credits)')
    }
    if ((!this.payment_code.is_check() && this.purchase_rows().length == 0) || (this.purchase_rows('old').length > 0 && this.purchase_rows('new').length == 0)) {
      this.errors.push('no purchase codes have been entered')
    }
    return this.errors.length == 0
  }

})

////////////////////////
/* Register.LedgerRow */
////////////////////////

// A debit or credit associated with an account.
// Config may be an Object of raw ledger entry fields as returned by the server,
// or code_type, code and amount for new ledger rows.
//
// A config object of raw ledger row data should have:
// * id: unique id for the row (only if saved, may be blank if returning from failed
//   validation...see read_only below)
// * type: GL account type (Asset, Liability, Income or Expense)
// * account_number: GL account number string ('1000.000' for example)
// * account_name: longhand GL account name
// * detail: a string with detail information about the row
// * register_code: unique shorthand code associated with the Register.Code
//   that generated this row (this is different than the GL account_code or
//   account_name, since multiple register codes might be tied to the same
//   account)
// * debit: debit amount
// * credit: credit amount
// * code_label: the longhand label associated with the Register.Code that generated this row
// * code_type: purchase, payment or change
//
// NOTE: Only debit or credit should have a value, not both.  
//
// The reason an existing ledger row
// configuration contains all of the account code/register code information directly rather
// than just referencing a Register.Code the way a new instance does, is because we may be
// making an adjustment to an existing payment from the past, and register codes may
// have been reconfigured since then.
//
// Generating a new LedgerRow from code would expect:
// * code_type: as above
// * code: a Register.Code instance
// * debit: debit amount OR
// * credit: credit amount
//
// NOTE: only one of either debit or credit should be present.
//
// Throws Register.Exceptions.LedgerRowException if both debit, credit are set,
// if amount is 0 or not a number, or if the code_type is not one of
// Register.LedgerRow.TYPES.
//
// Properties
//
// * read_only: (boolean) Existing ledger rows returned by the server may be
//   marked read-only if they are ledger entries which have already been
//   processed (if they have an id).  This is as opposed to unsaved ledger
//   entries returned during creation of a new payment due to validation errors.
Register.LedgerRow = function(config) {
  this.config = config || {}
  this.code = this.config.code || {}
  this.initialize()
}
Register.LedgerRow.inherits(Register.Core)
// Constants
Register.LedgerRow.PURCHASE_TYPE = 'purchase'
Register.LedgerRow.PAYMENT_TYPE = 'payment'
Register.LedgerRow.CHANGE_TYPE = 'change'
Register.LedgerRow.TYPES = $A([Register.LedgerRow.PURCHASE_TYPE, Register.LedgerRow.PAYMENT_TYPE, Register.LedgerRow.CHANGE_TYPE])
// Methods
Object.extend(Register.LedgerRow.prototype, Register.Events.handler_for('update', 'destroy'))
Object.extend(Register.LedgerRow.prototype, {
  initialize: function() {
    // set defaults from either this.config or this.code if available
    var set_default = function (args) {
      var fields = $A([args]).flatten()
      var ledger_row_field_name = fields[0]
      var code_field_name = fields[1] || ledger_row_field_name
      this[ledger_row_field_name] = this.config[ledger_row_field_name] || this.code[code_field_name]
    }.bind(this)
    $A([
      // LedgerRow.field_name, Code.field_name
      ['type', 'account_type'],
      'account_number',
      'account_name',
      ['register_code', 'code'],
      ['code_label', 'label'],
      'detail',
      'code_type',
    ]).each(set_default)

    if (!Register.LedgerRow.TYPES.include(this.code_type)) {
      throw(new Register.Exceptions.LedgerRowException('initialize', "Cannot initialize a LedgerRow whose code_type is not in Register.LedgerRow.TYPES: '#{type}'", { type: this.code_type }))
    } else if (this.config.credit && this.config.debit) {
      throw(new Register.Exceptions.LedgerRowException('intialize', "Cannot initialize a LedgerRow with both credit (#{credit}) and debit (#{debit}) values.", { credit: this.config.credit, debit: this.config.debit }))
    }

    var amount
    if (amount = this.config.debit) { this.set_debit(amount) }
    if (amount = this.config.credit) { this.set_credit(amount) }
    if (this.get_amount() == 0) {
      throw(new Register.Exceptions.LedgerRowException('initialize', "LedgerRow amount must be non-zero"))
    }
    // A row is read-only if it has an id (has been saved on the server)
    // (must be set /after/ amount is initialized above)
    this.read_only = this.config.id ? true : false
  },

  // True if this is a new row which has not yet been saved on the server.
  is_new: function() {
    return !this.read_only
  },

  get_label: function() {
    return this.code_label
  },

  get_debit: function() {
    return this.debit 
  },

  set_debit: function(amount) {
    return this.__set_amount(amount, 'debit')    
  },

  // True if the ledger row is a debit amount.
  is_debit: function() {
    return this.debit ? true : false
  },

  get_credit: function() {
    return this.credit
  },

  set_credit: function(amount) {
    return this.__set_amount(amount, 'credit')    
  },

  // True if the ledger row is a credit amount.
  is_credit: function() {
    return this.credit ? true : false
  },

  // Returns the credit or debit amount as a signed amount depending on account type.
  // (For Asset and Expense accounts, debits are positive; for Liability and Income
  // accounts, credits are positive.)
  get_amount: function() {
    var amount
    var getter = function (type) {
      var reverse = type == 'debit' ? 'credit' : 'debit'
      var value = this[type] ? this[type] : -1 * this[reverse]
      return value || 0
    }.bind(this)
    switch (this.type) {
      case 'Asset': case 'Expense': amount = getter('debit'); break
      case 'Liability': case 'Income': amount = getter('credit'); break
      default: throw( new Register.Exceptions.LedgerRowException('amount', "No account type matches: #{type}", { type: this.type }))
    }
    return amount
  },

  // Returns either credit or negative debit, ignoring the account type, unlike get_amount().
  get_credit_or_debit: function() {
    return this.credit || -1 * this.debit || 0
  },

  // Returns either debit or negative credit, ignoring the account type, unlike get_amount().
  get_debit_or_credit: function() {
    return this.debit || -1 * this.credit || 0
  },

  get_detail: function() {
    return this.detail
  },

  set_detail: function(value) {
    this.detail = value
    return value
  },

  // True if the row type is PAYMENT_TYPE.
  is_payment: function() {
    return this.code_type == Register.LedgerRow.PAYMENT_TYPE
  },

  // True if the row type is PURCHASE_TYPE
  is_purchase: function() {
    return this.code_type == Register.LedgerRow.PURCHASE_TYPE
  },

  // Unless row is read_only, updates the given field with the requested value
  // through it's setter method, then fires 'update' callbacks.
  update: function(name, value) {
    if (this.read_only) { return false }
    var result = this["set_" + name](value)
    this.fire('update')
    return result
  },

  // Unless row is read_only, Fires 'destroy' callbacks and deletes the
  // instance.
  destroy: function() {
    if (this.read_only) { return false }
    this.fire('destroy')
    return true
  },

  // Serialize as an Object.
  serialize: function() {
    return {
      type: this.type,
      account_number: this.account_number,
      account_name: this.account_name,
      detail: this.get_detail(),
      register_code: this.register_code,
      debit: this.get_debit(),
      credit: this.get_credit(),
      code_label: this.get_label(),
      code_type: this.code_type,
    }
  },

  __set_amount: function(raw_amount, type) {
    if (this.read_only) {
      throw( new Register.Exceptions.LedgerRowException('__set_amount', "Attempted to set #{type} to #{amount} for a read only row.", { type: type, amount: raw_amount }))
    }
    var amount = parseFloat(raw_amount) 
    if (isNaN(amount)) {
      throw( new Register.Exceptions.LedgerRowException('__set_amount', "Attempted to set #{type} but amount #{amount} is not a number.", { type: type, amount: amount }))
    } else if (amount == 0) {
      throw( new Register.Exceptions.LedgerRowException('__set_amount', "Cannot set a LedgerRow amount to zero."))
    }

    var setter = function (amount, reverse) {
      if (amount < 0) {
        amount = -amount
        this[type] = undefined
        this[reverse] = amount
      } else {
        this[type] = amount
        this[reverse] = undefined
      }
      return amount
    }.bind(this)

    var result
    switch (type) {
      case 'credit':
        result = setter(amount, 'debit'); break
      case 'debit':
        result = setter(amount, 'credit'); break
      default: throw( new Register.Exceptions.LedgerRowException('__set_amount', "Invalid type: #{type}", { type: type }))
    }
    
    return result
  },
})


/////////////////////
/* Register.UI     */
/////////////////////

// Provides the HTML and events for user interaction with the register.
Register.UI = function(register, template) {
  this.register = register
  this.ledger = register.ledger
  this.purchase_codes = register.purchase_codes
  this.payment_codes = register.payment_codes
  this.credit_codes = register.credit_codes
  this.adjustment_codes = register.adjustment_codes
  this.template_source = template || ''
}
Register.UI.inherits(Register.Core)
// Constants
Register.UI.AMOUNT_CREDITED_ID = 'amount-credited'
Register.UI.AMOUNT_CREDITED_ROW_SELECTOR = '.amount-credited.row'
Register.UI.AMOUNT_TENDERED_ID = 'amount-tendered'
Register.UI.AMOUNT_TENDERED_ROW_SELECTOR = '.amount-tendered.row'
Register.UI.CANCEL_CONTROL_SELECTOR = '.cancel-control a'
Register.UI.CC_INPUT = 'cc-input-popup'
Register.UI.CC_INPUT_AREA = 'cc-input'
Register.UI.CHANGE_DUE_ID = 'change-due'
Register.UI.CREDIT_CARD_TRACK_ONE_ID = 'payment_credit_card_track_one'
Register.UI.CREDIT_CARD_TRACK_TWO_ID = 'payment_credit_card_track_two'
Register.UI.ERRORS_SELECTOR = '.errorExplanation'
Register.UI.FORM_ID = 'payment-form'
Register.UI.KEY_PERCENT_SIGN = 37
Register.UI.LEDGER_ENTRIES_ID = 'ledger-entries'
Register.UI.LEDGER_ROW_TEMPLATE_ID = 'ledger-entry-row-template'
Register.UI.PAYMENT_CODES_SELECT_ID = 'payment-type'
Register.UI.PAYMENT_FIELDS_ID = 'payment-fields'
Register.UI.PURCHASE_AMOUNT_INPUT_ID = 'purchase-amount'
Register.UI.PURCHASE_CODES_SELECT_ID = 'purchase-code'
Register.UI.PURCHASE_CODES_SELECT_BLANK_VALUE = '*Blank*'
Register.UI.SUBMISSION_CONTROLS_ID = 'submission-controls'
Register.UI.TOTAL_COST_ID = 'total-cost'
// Methods
Object.extend(Register.UI.prototype, {

  // Call to prepare UI for interaction with Ledger and user.
  initialize: function() {
    var wrapper = new Element('div').update(this.template_source)
    this.register_template = wrapper.childElements().first()
    this.rows = $A()
    if (this.register_template) {
      // isolate ledger_row_template and set the root register element
      this.ledger_row_template = this.locate(Register.UI.LEDGER_ROW_TEMPLATE_ID, this.register_template).remove()
      this.ledger_row_template.id = null // don't want to propogate the template id in new rows...
      this.root = this.register_template.cloneNode(true)
      // isolate other important elements
      this.form = this.locate(Register.UI.FORM_ID)
      this.errors_div = this.locate(Register.UI.ERRORS_SELECTOR)
      this.errors_div.hide()
      this.ledger_entries = this.locate(Register.UI.LEDGER_ENTRIES_ID)
      this.purchase_amount_input = this.locate(Register.UI.PURCHASE_AMOUNT_INPUT_ID)
      this.payment_fields = this.locate(Register.UI.PAYMENT_FIELDS_ID)
      this.total = this.locate(Register.UI.TOTAL_COST_ID)
      this.tendered = this.locate(Register.UI.AMOUNT_TENDERED_ID)
      this.tendered_row = this.locate(Register.UI.AMOUNT_TENDERED_ROW_SELECTOR)
      this.credited = this.locate(Register.UI.AMOUNT_CREDITED_ID)
      this.credited_row = this.locate(Register.UI.AMOUNT_CREDITED_ROW_SELECTOR)
      this.change = this.locate(Register.UI.CHANGE_DUE_ID)
      this.submission_controls = this.locate(Register.UI.SUBMISSION_CONTROLS_ID)
      this.cancel_control = this.locate(Register.UI.CANCEL_CONTROL_SELECTOR)
      this.credit_card_track_one = this.locate(Register.UI.CREDIT_CARD_TRACK_ONE_ID)
      this.credit_card_track_two = this.locate(Register.UI.CREDIT_CARD_TRACK_TWO_ID)
      this.credit_card_input_popup = this.locate(Register.UI.CC_INPUT)
      this.credit_card_input = this.locate(Register.UI.CC_INPUT_AREA)
      // populate select controls with codes
      this.purchase_codes_select = this.locate(Register.UI.PURCHASE_CODES_SELECT_ID)
      this.update_from_array(
        this.purchase_codes_select,
        this.make_options(
          this.purchase_codes, 
          'id', 
          function(o) { return o.code + " (" + o.label.truncate(35) + ")" }, 
          { value: Register.UI.PURCHASE_CODES_SELECT_BLANK_VALUE, label: '- Select a code -' }
        ),
        true
      )
      this.payment_codes_select = this.locate(Register.UI.PAYMENT_CODES_SELECT_ID)
      this.update_from_array(
        this.payment_codes_select, 
        this.make_options({
            Payments: this.payment_codes,
            Credits: this.credit_codes,
            Adjustments: this.adjustment_codes,
          },
          'id',
          'label'
        )
      )
      // set up existing payment/ledger information
      this.set_payment_fields_from_payment()
      this.set_ledger_history()
      // initialize callback functions in the root register so that it will respond to
      // user actions
      this.initialize_register_callbacks()
      // set the register's title header
      this.set_title()
      // ensure UI is updated when ledger changes.
      this.ledger.add_listener('update', this.update.bind(this))
      // set visible payment fields
      // set ledger payment code to first available
      this.handle_payment_code_select()
      this.cc_hide_and_disable_input()
    }
    return this
  },

  // Reset total amounts based on current ledger.
  update: function() {
    this.total.update(this.monetize(this.ledger.get_purchase_total(), true))
    this.tendered.ledger_value = this.ledger.get_tendered_total()
    this.tendered.value = (this.monetize(this.tendered.ledger_value, true))
    this.credited.ledger_value = this.ledger.get_credited_total()
    this.credited.update(this.monetize(this.credited.ledger_value, true))
    this.change.update(this.monetize(this.ledger.get_change_total(), true))
    this.tendered.ledger_value == 0 ? this.tendered_row.hide() : this.tendered_row.show()
    this.credited.ledger_value == 0 ? this.credited_row.hide() : this.credited_row.show()
  },

  display_errors: function() {
    this.errors_div.update('')
    var payment_error = this.register.payment_error
    var validation_errors = this.register.validation_errors
    if (payment_error || validation_errors) {
      this.errors_div.insert(new Element('h2').update('Payment Errors'))
      if (payment_error) {
        this.errors_div.insert(new Element('p').update(payment_error)) 
      }
      if (validation_errors) {
        var ul = new Element('ul')
        $A(validation_errors.errors).each(function(err) {
          ul.insert(new Element('li').update(err))
        })
        this.errors_div.insert(ul)
        this.payment_fields.select('.fieldWithError').invoke('removeClassName', '.fieldWithError')
        $A(validation_errors.on).each(function(attr) {
          var field = this.find_payment_field(attr)
          if (field) { field.addClassName('fieldWithError') }
        }, this)
      }
      this.errors_div.show()
    }
  },

  // Returns an Array of the enabled payment fields (including hidden inputs).
  // Returns all payment fields if include_disabled is true.
  get_payment_fields: function(include_disabled) {
    if (typeof this.all_payment_fields == 'undefined') {
      this.all_payment_fields = this.payment_fields.select('input','select','textarea')
    }
    return include_disabled ?
      this.all_payment_fields :
      this.all_payment_fields.findAll(function(e) {
        return !e.disabled
      })
  },

  // Returns an Array of all visible, and enabled payment fields. 
  get_enabled_visible_payment_fields: function() {
    return this.get_payment_fields(false).reject(function(e) {
      return !e.visible() || e.type == 'hidden'
    })
  },

  // Find an enabled payment field by field.id.  (Will prefix 'payment_' if id
  // does not already include it.)
  // Set include_disabled to true to find any payment field by id.
  find_payment_field: function(id, include_disabled) {
    id = id.match(/^payment_/) ? id : 'payment_' + id
    return this.get_payment_fields(include_disabled).detect(function(f) { return f.id == id })
  },

  // Returns an Array of the enabled submission controls.
  get_submission_controls: function(all) {
    return this.submission_controls.select('input').findAll(function(e) {
      return all ? true : !e.disabled
    })
  },

  // Find an enabled submission control by field.id.  (Will prefix
  // 'payment_submit_' if id does not include it.)
  find_submission_control: function(id) {
    id = id.match(/^payment_submit_/) ? id : 'payment_submit_' + id
    return this.get_submission_controls().detect(function(f) { return f.id == id })
  },

  // Returns the payment code object associated with the currently selected payment type.
  get_payment_code: function() {
    return this.register.find_code(this.payment_codes_select.value)
  },

  // Returns the current payment_type string value as determined by the setting
  // of the payment-type select control.
  get_payment_type: function() {
    return this.get_payment_code().payment_type
  },

  // Hides or shows and enables or disables payment fields based on the
  // currently selected payment type.
  setup_payment_type_fields: function() {
    Register.UI.setup_payment_fields_by_type_for(this.root, this.get_payment_type())
  },

  // Sets payment field values from register.payment.
  set_payment_fields_from_payment: function() {
    var payment = this.register.payment
    payment.fields.each(function(field_name) {
      var input = this.find_payment_field(field_name, true)
      if (input) {
        input.value = payment[field_name]
      }
    }, this)
  },

  // Creates read only ledger row history from any existing ledger purchase or change rows
  // (if we are updating a previous payment).  Also disables amount tendered input if
  // we are updating a previous payment.
  set_ledger_history: function() {
    if (this.is_refund()) {
      this.ledger.get_rows('old').each(function(row) {
        if (!row.is_payment()) {
          this.add_ledger_history_row(row)
        }
      }, this)
      this.tendered.disabled = true
    }
  },

  // True if we are creating a new payment.
  is_new: function() {
    return this.register.payment.is_new()
  },

  set_title: function() {
    var title = this.register.is_new() ? "New Payment" : "Payment #" + this.register.id()
    this.root.down('.title').update(title)
    return title 
  },

  // Generate and return a set of select options.  One option is generated for
  // each object in the passed array.  Or if an object is given, optgroups 
  // are generated for each property, and the property's array value is converted
  // to options.
  //
  // * array_or_object: if given an array, converts to options.  If given an object,
  //   converts each property into an optgroup of options.
  // * label_method: may be passed a function which in turn will be passed each
  //   option in the array (for generating custom labels)
  make_options: function(array_or_object, value_method, label_method, default_option_values) {
    var default_option, options
    if (default_option_values) {
      default_option = new Element('option', { value: default_option_values.value }).update(default_option_values.label)
    } 
    if (array_or_object instanceof Array) {
      options = $A(array_or_object).map(function(o) {
        var value = Object.__send(o, value_method)
        var label = (typeof label_method == 'function') ?
          label_method(o) :
          Object.__send(o, label_method)
        return new Element('option', { value: value }).update(label)
      })
    } else {
      options = $A([])
      var opt_group
      for (opt_group in array_or_object) {
        options.push(
          this.update_from_array(
            new Element('optgroup', { label: opt_group }),
            this.make_options(array_or_object[opt_group], value_method, label_method),
            true
          )
        )
      }
    }
    if (default_option) { options.unshift(default_option) }
    return options
  },

  // A read-only ledger when updating a payment.
  add_ledger_history_row: function(ledger_row) {
    return this._add_ledger_row(ledger_row)
  },

  add_ledger_row: function(code_id, amount) {
    return this._add_ledger_row(this.register.ledger.add_purchase(code_id, amount))
  },

  _add_ledger_row: function(ledger_row) {
    var ui_row = (new Register.UI.Row(this, ledger_row))
    this.rows.push(ui_row)
    this.ledger_entries.insert(ui_row.root)
    return ui_row
  },

  remove_ledger_row: function(ui_row) {
    this.rows.remove(this.rows.indexOf(ui_row))
  },

  // Clear purchase amount, set purchase codes to default and move focus back to
  // purchase amount.
  reset_ledger_entry_input_controls: function() {
    this.purchase_amount_input.value = null 
    this.purchase_codes_select.value = Register.UI.PURCHASE_CODES_SELECT_BLANK_VALUE
    this.purchase_amount_input.activate()
  },

  serialize: function() {
    var serialized = {}
    this.get_payment_fields().inject(serialized, function(object,field) {
      object[field.name] = field.value
      return object
    })
    serialized['payment[type]'] = this.get_payment_type()
    serialized[this.successful_submitter.name] = this.successful_submitter.value
    return serialized
  },

  validate: function() {
    var valid = this.ledger.validate()
    this.errors = this.ledger.errors.clone()
    required = this.get_enabled_visible_payment_fields().select(function(e) {
      return e.hasClassName('required') && !e.present()
    })
    if (required.size() > 0) {
      valid = false
      this.errors.push('required fields have not been entered: ' + required.map(function(e) { return e.id.replace(/payment_/,'') }))
    }
    return valid
  },

  // Callback for user choosing an entry in the purchase code select.
  // XXX Is there a good reason to add callbacks around the UI events?  Rather than
  // callbacks around core register events like totals updates?
  handle_purchase_code_select: function(event) {
    if (this.before_purchase_code_select && !this.before_purchase_code_select()) {
      event.stop()
    } else {
      var amount = this.purchase_amount_input.value
      var code_id = this.purchase_codes_select.value
      if (isNaN(parseFloat(amount))) {
        this.alert_user("Please enter an amount")
      } else if (isNaN(code_id)) {
        // do not attempt to add -- default code row selected.
      } else {
        this.add_ledger_row(code_id, amount)
        if (this.after_purchase_code_select) { this.after_purchase_code_select() }
      }
      this.reset_ledger_entry_input_controls()
    }
  },

  // If we have not yet begun to process a credit card, and we detect a '%'
  // while payment type is for a credit card, ensure that focus is on 
  // the purchase amount input control which has a handler for parsing credit
  // tracks. 
  handle_register_card_swipe: function(event) {
    if (!this.processing_a_credit_card && event.charCode == Register.UI.KEY_PERCENT_SIGN) {
      var payment_code = this.get_payment_code()
      if (payment_code.is_credit_card()) {
        event.stop()
        this.processing_a_credit_card = true
        this.credit_card_input.enable()
        this.credit_card_input.value = '%'
        this.credit_card_input_popup.show()
        this.credit_card_input.focus()
      }
    }
  },

  // If we are processing a credit card swipe, parse content for valid credit card
  // track data and place into the payment fields if received.
  handle_credit_card_input: function(event) {
    if (this.processing_a_credit_card) {
      try {
        var parser = new CreditCardTrackData(this.credit_card_input.value)
        if (parser.is_minimally_valid()) {
          this.credit_card_track_one.value = parser.track1.raw
          this.credit_card_track_two.value = parser.track2.raw
          this.find_payment_field('credit_card_number').value = parser.number
          this.find_payment_field('credit_card_month').value = parser.month()
          this.find_payment_field('credit_card_year').value = parser.year()
          this.find_payment_field('credit_card_first_name').value = parser.first_name
          this.find_payment_field('credit_card_last_name').value = parser.last_name
          this.cc_hide_moto_fields()
        }
      } catch(err) {
        if (typeof(err) == 'string' && err.match(/^CCTD/)) {
          this.alert_user('Unable to parse credit card, please try swiping it again')
        } else {
          throw(err)
        }
      } finally {
        this.processing_a_credit_card = false
        this.cc_hide_and_disable_input()
      }
    }
  },

  // Callback for user changing the payment type.
  handle_payment_code_select: function(event) {
    this.setup_payment_type_fields()
    this.ledger.set_payment_code(this.get_payment_code())
  },

  // Callback for user changing the amount tendered.
  handle_amount_tendered_input: function(event) {
    this.ledger.set_amount_tendered(this.tendered.value)
  },

  // Callback for user clicking the cancel control.
  handle_cancel_control_click: function(event) {
    return this.register.cancel(event)
  },

  handle_submit_control_clicked: function(event) {
    this.successful_submitter = event.findElement()
    return true
  },

  handle_form_submit: function(event) {
    event.stop()
    if (!this.validate()) {
      var message = "Please correct the following:\n"
      this.errors.each(function(m) {
        message = message + " * " + m + "\n"
      })
      this.alert_user(message)
    } else {
      // double-check authorization or record calls for credit cards.
      if (this.successful_submitter.value == 'Authorize') {
        if (!confirm("Authorizing will put a temporary hold in the amount of " + this.monetize(this.ledger.get_amount_tendered_or_credited(), true) + " on the guest's credit card.  No funds will be transferred.  You may capture the funds later in a separate transaction.  Continue?")) {
          return false
        }
      }
      if (this.successful_submitter.value == 'Record' && this.get_payment_code().is_credit_card()) {
        if (!confirm("Recording this credit card transaction will not capture any funds.  This should only be used to record a credit card transaction made through some other agency.  Continue?")) {
          return false
        }
      }
      return this.register.submit(event)
    }
    return false
  },

  // Initializes callback functions on user controls in the current root register ui.
  // * purchase-code select - on change create a ledger row, update totals
  // * payment-type select - on change update register payment state and hide/show
  //   correct payment fields.
  // * amount-tendered - on change parse possible credit card track data 
  // * card swipe - key logger to detect and handle card swipe
  // * tabbing - keep tab cycle within register
  // * submission - validate before submit
  initialize_register_callbacks: function() {
    this.initialize_purchase_code_controls()
    this.initialize_payment_code_controls()     
    this.initialize_amount_tendered_control()
    this.initialize_submission_controls()
    if (!this.is_refund()) {
      this.initialize_register_card_swipe()
    }
    this.initialize_tabbing_controls()
  },

  // Attaches onchange callback to UI amount-tendered input to update the ledger.
  initialize_amount_tendered_control: function() {
    this.tendered.observe('change', this.handle_amount_tendered_input.bind(this))
  },

  // Attaches onchange callback to UI purchase-code select to add new ledger rows.
  initialize_purchase_code_controls: function() {
    this.purchase_codes_select.observe('change', this.handle_purchase_code_select.bind(this))
  },

  // Attaches onchange callback to UI payment-type select to change the payment type and
  // show/hide associated fields.
  initialize_payment_code_controls: function() {
    this.payment_codes_select.observe('change', this.handle_payment_code_select.bind(this))
  },
  
  // Attaches onsubmit callback to UI submission controls, and an onclick callback
  // for cancel control.
  initialize_submission_controls: function() {
    this.cancel_control.observe('click', this.handle_cancel_control_click.bind(this))
    this.form.observe('submit', this.handle_form_submit.bind(this))
    this.get_submission_controls(true).each(function(submit) {
      submit.observe('click', this.handle_submit_control_clicked.bind(this)) 
    }, this)
    this.form.observe('keypress', this.handle_enter_key_submit.bind(this))
  },
  
  initialize_register_card_swipe: function() {
    this.processing_a_credit_card = false
    this.form.observe('keypress', this.handle_register_card_swipe.bind(this))
    this.credit_card_input.observe('change', this.handle_credit_card_input.bind(this))
  },

  cc_hide_and_disable_input: function() {
    this.credit_card_input_popup.hide()
    this.credit_card_input.value = ''
    this.credit_card_input.disable()
    return this.credit_card_input_popup
  },

  // Hide credit card fields only associated with moto transactions.
  // XXX Clean up hard coded selectors.
  cc_hide_moto_fields: function() {
    $('payment_credit_card_verification_value').hide()
    $$('label[for=payment_credit_card_verification_value]').first().hide()
    $('payment_credit_card_billing_address').hide()
    $$('label[for=payment_credit_card_billing_address]').first().hide()
    $('payment_credit_card_zip_code').hide()
    $$('label[for=payment_credit_card_zip_code]').first().hide()
  },

  // With multiple submit buttons, Firefox fails to submit after hitting enter
  // in an input control if the first submit button is disabled.  So if we have
  // three submit buttons and the first two are disabled, we can no longer
  // submit by hitting the enter key in an input control.  So we add keypress
  // observers to the input controls to make up for this.
  handle_enter_key_submit: function(event) {
    var current_input = event.findElement()
    if (event.keyCode == Event.KEY_RETURN && current_input.type == 'text') {
      event.stop()
      if (this.processing_a_credit_card) {
        this.get_enabled_visible_payment_fields().first().focus()
      } else if (current_input == this.purchase_amount_input && current_input.present()) {
        this.purchase_codes_select.focus() 
      } else if (current_input == this.purchase_amount_input || this.get_payment_fields().include(current_input)) {
        this.get_submission_controls().first().click()
      }
    }
  },
  
  // Ensures that tabbing/shift-tabbing circles only within register controls.
  initialize_tabbing_controls: function() {
    // register submit catches tab and focuses on amount-input for a closed tabbing loop
    this.get_submission_controls().last().observe('keypress', function(event) {
      if (event.keyCode == Event.KEY_TAB && !event.shiftKey) {
        event.stop()
        this.purchase_amount_input.activate()
      }
    }.bind(this))
    // register amount-input catches shift-tab and focuses back to payment submit
    this.purchase_amount_input.observe('keypress', function(event) {
      if (event.keyCode == Event.KEY_TAB && event.shiftKey) {
        event.stop()
        this.get_submission_controls().last().focus()
      }
    }.bind(this))
    // register payment_type catches tab, allows onChange to fire to ensure that
    // fields are hidden/shown based on payment type, and then moves to the next
    // input that would be available by payment type
    this.payment_codes_select.observe('keypress', function(event) {
      if (event.keyCode == Event.KEY_TAB && !event.shiftKey) {
        // Allow a moment for the onChange event to complete updates to the 
        // enabled/disabled fields
        setTimeout(function() { 
          this.get_enabled_visible_payment_fields().first().focus()
        }.bind(this), 100)
      } 
    }.bind(this))
  },

})
// Type Functions

// Utility function hides or shows and enables or disables payment fields in the passed
// element based on the given payment type.
Register.UI.setup_payment_fields_by_type_for = function(payment_section, payment_type) {
  payment_section.select('.show-by-type').each(function(e) {
    e.hide()
    e.select('input','select','textarea').invoke('disable')
  })
  payment_section.select('.show-by-type.' + payment_type).each(function(e) {
    e.select('input','select','textarea').invoke('enable')
    e.show()
  })
}


// Provides the HTML and events for user interaction with a ledger row in the register.
Register.UI.Row = function(ui, ledger_row) {
  this.ui = ui
  this.ledger_row = ledger_row
  this.root = this.ui.ledger_row_template.cloneNode(true)
  this.initialize()
}
Register.UI.Row.inherits(Register.Core)
// Constants
Register.UI.Row.LABEL_SELECTOR = '.label'
Register.UI.Row.DEBIT_SELECTOR = '.debit-row-control'
Register.UI.Row.CREDIT_SELECTOR = '.credit-row-control'
Register.UI.Row.DETAIL_SELECTOR = '.detail-row-control'
Register.UI.Row.REMOVE_SELECTOR = '.remove-row-control'
// Methods
Object.extend(Register.UI.Row.prototype, {
  initialize: function() {
    this.label = this.locate(Register.UI.Row.LABEL_SELECTOR)
    this.initialize_input('debit')
    this.initialize_input('credit')
    this.initialize_input('detail')
    this.initialize_input('remove')
    this.ledger_row.add_listener('update', this.update.bind(this))
    this.ledger_row.add_listener('destroy', this.destroy.bind(this))
    this.initialize_callbacks()
    this.update()
  },

  // Initializes the specified input control with meta data and helper functions for
  // callbacks.
  initialize_input: function(name) {
    var selector = Register.UI.Row[name.toUpperCase() + "_SELECTOR"]
    var input = this[name] = this.locate(selector)
    input.ui_row = this
    input.ledger_field_name = name
    if (name == 'credit' || name == 'debit') {
      input.is_a_credit_or_debit_field = true
    }

    // If row is not new, inputs should be disabled.
    // A debit or credit field should only enable if the row is a debit or credit.
    input.allow_enable = function() {
      var ledger_row = this.ui_row.ledger_row
      var enable_allowed = true
      if (!ledger_row.is_new() ||
         (this.is_a_credit_or_debit_field &&
          !ledger_row["is_" + this.ledger_field_name]())) {
        enable_allowed = false
      }
      return enable_allowed
    }

    input.reset_enable = function() {
      this.allow_enable() ?
        this.enable() :
        this.disable()
      return input
    }

    return input 
  },

  // Set the row's html field values from the internal ledger_row values.
  update: function() {
    this.label.update(this.ledger_row.get_label())
    this.__set('debit', true)
    this.__set('credit', true)
    this.__set('detail')
    this.reset_enable()
    return this
  },

  // Set the given input from the internal ledger_row state.
  // Null or undefined values will be set as the empty string.
  // Non-null numbers will be monetized if monetize_value is set true.
  __set: function(name, monetize_value) {
    var value = this.ledger_row["get_" + name]()
    value = value || ''
    this[name].value = monetize_value ? this.monetize(value) : value
    return this
  },

  // Returns an Array of the row's form controls.
  get_controls: function() {
    return this.root.select('input','select','textarea')
  },

  // Reset the row's form controls to be either enabled or disabled based on state.
  // (Whether they are read-only or empty debit or credit inputs)
  reset_enable: function() {
    this.get_controls().invoke('reset_enable')
  },

  // Enable all of the row's form controls.
  enable: function() {
    this.get_controls().invoke('enable')
  },

  // Disable all of the row's form controls.
  disable: function() {
    this.get_controls().invoke('disable')
  },

  // True if this row reflects a read only ledger row.
  read_only: function() {
    return !this.ledger_row.is_new()
  },

  // Setup the event callbacks for the row's controls.
  // * ledger row value - on change flip credit/debit if switch from positive to negative,
  //   delete if zero, update totals
  // * ledger row remove - on click remove ledger row, update totals
  initialize_callbacks: function() {
    this.remove.observe('click', this.handle_remove.bind(this))
    $A(['credit', 'debit', 'detail']).each(function(control) {
      this[control].observe('change', this.handle_update)
    }, this)
  },

  handle_remove: function(event) {
    this.ledger_row.destroy()
  },

  // Not bound to UI.Row because we want the Input.value and this
  // handle is generic to all the text Input elements in the row.
  handle_update: function(event) {
    var ui_row = this.ui_row
    var ledger_row = ui_row.ledger_row
    if (this.is_a_credit_or_debit_field) {
      var numeric_value = parseFloat(this.value)
      if (this.value.empty() || numeric_value == 0) {
        return ledger_row.destroy()
      } else if (isNaN(numeric_value)) {
        ui_row.alert_user("Please enter a number")
        ui_row.__set(this.ledger_field_name, true)
        return false
      }
    }
    return ledger_row.update(this.ledger_field_name, this.value)
  },

  // Remove the row from the ledger and destroy it.
  destroy: function() {
    this.root.remove() // remove from Document
    this.ui.remove_ledger_row(this)
    return true
  },
})


////////////////////////
/* Simple Inheritance */
////////////////////////

Function.prototype.inherits = function(parent_function) { 
  this.prototype = new parent_function
  this.prototype.constructor = this
  this.prototype.parent = parent_function.prototype
  return this
} 

/////////////////////////
/* Object Utilities    */
/////////////////////////

Object.extend(Object, {
  is_null_or_undefined: function(object) {
    return object === null || typeof(object) == 'undefined'
  },

  // Looks up the given property on the given object.  If it is a function, applies
  // it with the given array of arguments and returns the value, otherwise just
  // returns the value.
  __send: function(object, property, args) {
    var value = object[property]
    if (typeof(value) == 'function') {
      value = value.apply(object, args)
    }
    return value
  },
})

/////////////////////////
/* Array methods       */
/////////////////////////

// Array Remove - By John Resig (MIT Licensed)
Array.prototype.remove = function(from, to) {
  var rest = this.slice((to || from) + 1 || this.length);
  this.length = from < 0 ? this.length + from : from;
  return this.push.apply(this, rest);
}

// Sums all the elements of an array.
//
// If a property is passed, each element is tested for the property.
//
// If it exists, and is a function, then it is called and the returned value is added.
//
// If it exists, but is not a function, then it is added.
//
// Otherwise, the element itself is added.
//
// Each value is coerced with parseFloat().  If the result is NaN it
// is excluded from the sum.
//
// (The default property to be tested is 'value' if none is given)
//
// The sum of an empty array is undefined.
//
// Examples:
//
//   [].sum() // => undefined
//   [1,2,3].sum() // => 6
//   ['1','2','foo'].sum() // => 3
//   [{ value: 2 }, { value: 5 }, { value: 3}].sum() // => 10
//   [{ amount: '1' }, { amount: '2' }, {}].sum('amount') // => 3
//
Array.prototype.sum = function(property_name) {
  if (this.length == 0) { return undefined }
  property_name = property_name || 'value'
  return this.inject(0, function(sum, v) {
    var value
    var property = v[property_name]
    switch (typeof(property)) {
      case 'undefined': value = v; break
      case 'function': value = v[property_name](); break
      default: value = property
    }
    value = parseFloat(value)
    return (isNaN(value) ? sum : (sum + value))
  })
}

// Returns all form controls which are not disabled, not visible, and
// not Input[type] == 'hidden'
//
// If an ancestor is provided, then the elements must also be children
// of this ancestor (useful for obtaining a subset of form controls).
var FormUtils = {
  get_enabled_elements: function(element, ancestor) {
    return element.getElements().reject(function(e) { 
      var reject = e.disabled || !e.visible() || e.type == 'hidden'
      if (ancestor instanceof Element) {
        reject = reject || !e.ancestors().include(ancestor)
      }
      return reject
    })
  }
}
Element.addMethods('form', FormUtils)

