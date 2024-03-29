document.addEventListener('DOMContentLoaded', bindButtons);
dropdownData = document.addEventListener('DOMContentLoaded', getDropdownData);

// BUTTON BINDINGS (ON PAGE LOAD)

function bindAdd(btn) {

    btn.addEventListener('click', function(event) {
        event.preventDefault();
        console.log(event);
        addRow(btn)
        }
    );
}

function bindDelete(btn) {

    btn.addEventListener('click', function(event) {
        event.preventDefault();
        console.log(event);
        deleteRow(btn);
        }
    );
}

function bindEdit(btn, dropdownData) {

    btn.addEventListener('click', function(event) {
        event.preventDefault();
        console.log(event);
        makeEditable(event, dropdownData);
        }
    );
}

function bindSubmitEdit(btn, originalContent) {
    btn.addEventListener('click', function(event) {
        event.preventDefault();
        console.log(event);
        submitEdit(event, originalContent);
        }
    );
}

function bindCancelEdit(btn, originalContent) {
    btn.addEventListener('click', function(event) {
        event.preventDefault();
        console.log(event);
        cancelEdit(event, originalContent);
        }
    );
}

function bindButtons() {
    dropdownData = getDropdownData();

    const add = document.getElementById('add');
    bindAdd(add);

    const del = document.getElementsByName('del');
    for (let d of del) {
        bindDelete(d);
    }

    const edit = document.getElementsByName('edit');
    for (let e of edit) {
        bindEdit(e, dropdownData);
    }

}

// REQUEST HANDLERS

// NOTE: only edit and cancel edit buttons are working (UI only)
// TO DO:
// - refactor add and delete buttons (UI)
// - eventually need to integrate with our backend

function getDropdownData(data, element) {

    if (!data) {
        let req = new XMLHttpRequest();
        url = '/get-dropdown-data'
        req.open('POST', url, true);
        req.setRequestHeader('Content-Type', 'application/json');
        req.addEventListener('load', () => {
            if (req.status < 400) {
                console.log('request successful')
                response = JSON.parse(req.responseText);

                console.log(response);
                dropdowns = document.getElementsByTagName('select');
                for (dropdown in dropdowns) {
                    dropdownName = dropdowns[dropdown].name;
                    console.log(dropdownName);
                    if (dropdownName in response) {
                        data = response[dropdownName]
                        console.log(response[dropdownName]);
                        for (option in data) {
                            value = data[option][dropdownName];
                            console.log(data[option][dropdownName]);
                            el = document.createElement('option');
                            el.value = value;
                            el.innerText = value;
                            dropdowns[dropdown].appendChild(el);
                        }
                    }
                }
            } else {
                console.log('looks like an error happened');
            }
        });


        dropdowns = document.getElementsByTagName('select');
        data = [];
        for (el in dropdowns) {
            data.push(dropdowns[el]['name']);
        }

        req.send(JSON.stringify(data));
        return data
    }

    else {
        // get-dropdown-data was passed an element on which to append the list of options
        // we already have the response data and this doesn't need to be added to existing dropdowns.
        if (element) {
            console.log('got an element')
            dropdownName = element.name;
            console.log(dropdownName);
            console.log(data)
            if (dropdownName in response) {
                data = response[dropdownName]
                console.log(response[dropdownName]);
                for (option in data) {
                    value = data[option][dropdownName];
                    console.log(data[option][dropdownName]);
                    el = document.createElement('option');
                    el.value = value;
                    el.innerText = value;
                    element.appendChild(el);
                }
            }
        }
    }
}


function addRow(btn) {
    // Request body
    const rowData = {}

    // Get data elements in the form.
    const formElements = btn.parentNode.querySelectorAll('.add-input')

    // Add the element values to the request body.
    formElements.forEach(element => {
        rowData[element.name] = element.value
        if (!element.value) {
            rowData[element.name] = null
        }
    })

    // ** MAKE DB REQUEST ** //
    // Open up a request and send to the app
    const req = new XMLHttpRequest();
    url = '/add-data'
    req.open('POST', url, true);
    req.setRequestHeader('Content-Type', 'application/json');
    req.addEventListener('load', () => {
        if (req.status < 400) {
            const id = JSON.parse(req.responseText)['id']
            if (id) {
                rowData.id = id
            }
            // Append the new data to the table
            addToTable(rowData);
            // Refresh table filters
            tf.refreshFilters()
        } else {
            alert('Unable to add a new entry at this time. Either name is not unique or required data is missing.')
            console.log('looks like an error happened');
        }
    });

    req.send(JSON.stringify(rowData));
}

function submitEdit(event, originalContent) {
    // buttons are nested in <td> which is in a <tr>
    let tableRow = event.target.parentElement.parentElement;
    let rowId = tableRow.id;
    let row = document.getElementById(rowId);

    let body = {};
    console.log(row)
    body['id'] = rowId;
    for (let element of row.children) {

        if (element.childElementCount == 0) {
            let name = element.getAttribute('name');
            let value = element.textContent;
            body[name] = value;

        } else if ((element.firstElementChild.tagName == 'INPUT') ||
                  (element.firstElementChild.tagName == 'SELECT')) {

                let name = element.firstElementChild.getAttribute('name');
                let value;
                if (!element.firstElementChild.value) {
                    value = null;
                } else {
                    value = element.firstElementChild.value;
                }
                body[name] = value;
        }
    }
    console.log(body);
    // Open up a request and send to the app
    let req = new XMLHttpRequest();
    url = '/update-data'
    req.open('PUT', url, true);
    req.setRequestHeader('Content-Type', 'application/json');
    req.addEventListener('load', () => {
        if (req.status < 400) {
            console.log(req.responseText);
            cancelEdit(event);
            // Refresh table filters
            tf.refreshFilters()
        } else {
            console.log('looks like an error happened');
            alert('Unable to submit edit. Edit must be different from original values. Double check your data and try again.')
            cancelEdit(event, originalContent);
        }
    });
    req.send(JSON.stringify(body));
}

function deleteRow(btn) {
    // Request body
    const rowData = {}

    // buttons are nested in <td> which is in a <tr>
    const tableRow = btn.parentElement.parentElement;

    // Get table cell elements
    // (exclude non-data containing cells like "update" or "delete")
    const tableCells = tableRow.querySelectorAll('td[name]:not([name=""])')
    // Add the cell elements' inner text to the request body.
    tableCells.forEach(element => {
        rowData[element.attributes['name'].value] = element.innerText
    })

    // ** MAKE DB REQUEST ** //
    // // Open up a request and send to the app
    const req = new XMLHttpRequest();
    url = '/delete-data'
    req.open('POST', url, true);
    req.setRequestHeader('Content-Type', 'application/json');
    req.addEventListener('load', () => {
        if (req.status < 400) {
            // Remove the row from the table
            tableRow.remove()
            // Refresh table filters
            tf.refreshFilters()
        } else {
            console.log('looks like an error happened');
        }
    });

    req.send(JSON.stringify(rowData));

}

// UI HANDLERS

function addToTable(rowData) {
    // present the data as a new tableRow in the table
    const tbody = document.querySelector('tbody');
    newrow = document.createElement('tr');

    // Set the html data for the new row's data cells
    for (let data in rowData) {
        const td = document.createElement('td')
        if (data == 'id') {
            td.setAttribute('name', rowData[data][0])
            td.innerText = rowData[data][1]
            newrow.id = rowData[data][1]
            newrow.prepend(td)
        }
        else {
            td.setAttribute('name', data)
            td.innerText = rowData[data]
            newrow.append(td);
        }
    }

    // Create an edit button if the table is NOT device_function
    if (window.location.pathname != '/device_function') {
        const edit = document.createElement('td')
        const editBtn = document.createElement('button')
        editBtn.name = 'edit'
        editBtn.textContent = 'Update'
        bindEdit(editBtn)
        edit.append(editBtn)
        newrow.append(edit)
    }

    // Create the delete button
    const del = document.createElement('td');
    const delBtn = document.createElement('button');
    delBtn.name = 'del';
    delBtn.textContent = 'Delete';
    bindDelete(delBtn);
    del.append(delBtn);
    newrow.append(del);

    // Add the new row to the table
    tbody.append(newrow);
}

function makeEditable(event, dropdownData) {
    // buttons are nested in <td> which is in a <tr>
    let tableRow = event.target.parentElement.parentElement;
    let rowId = tableRow.id;

    let originalContent = {};

    let row = document.getElementById(rowId);
    let exclude = ['deviceID', 'locationID', 'missionID', 'functionID', 'operatorID'];
    let dropdowns = ['deviceName', 'locationName', 'missionName', 'operatorName', 'functionName'];
    let dropdownExclude = {'devices': 'deviceName',
                           'locations': 'locationName',
                           'missions': 'missionName',
                           'operators': 'operatorName',
                           'functions': 'functionName'
                           };

    console.log(exclude);
    for (let child of row.children) {
        if (!(exclude.includes(child.getAttribute('name')))) {
            // no inner element means just raw data in the <td>
            if (!child.firstElementChild) {
                console.log(child.getAttribute('name'));

                // the field in question requires a dropdown
                let table = document.getElementById('display-data');
                if (dropdowns.includes(child.getAttribute('name')) &&
                    child.getAttribute('name') != dropdownExclude[table.getAttribute('name')]) {

                        document.getElementsByClassName('')

                        let field = document.createElement('select');
                        field.name = child.getAttribute('name');
                        field.value = child.textContent;
                        field.innerText = child.textContent;

                        option = document.createElement('option')
                        option.value = child.textContent;
                        option.innerText = child.textContent;
                        field.appendChild(option)

                        originalContent[field.name] = field.value;
                        child.textContent = '';
                        child.append(field);

                        getDropdownData(dropdownData, field);

                } else {

                    let field = document.createElement('input');
                    field.name = child.getAttribute('name');


                    if (child.getAttribute('name') == 'dateLaunched') {
                        field.type = 'date';
                        field.value = child.textContent;
                    }

                    else {
                        field.type = 'text';
                        field.value = child.textContent;
                    }

                    originalContent[field.name] = field.value;
                    child.textContent = '';
                    child.append(field);
                }


            // the <td> has the edit button in it
            } else if (child.firstElementChild.name == 'edit') {
                let submitBtn = document.createElement('button');
                submitBtn.name = 'submit';
                submitBtn.textContent = 'Submit';
                bindSubmitEdit(submitBtn, originalContent);

                child.replaceChild(submitBtn, child.firstElementChild);

            // the <td> has the delete button in it
            } else if (child.firstElementChild.name == 'del') {
                let cancelBtn = document.createElement('button');
                cancelBtn.name = 'cancel';
                cancelBtn.textContent = 'Cancel';
                bindCancelEdit(cancelBtn, originalContent);

                child.replaceChild(cancelBtn, child.firstElementChild);
            }
        }
    }
}

function cancelEdit(event, originalContent) {
    // buttons are nested in <td> which is in a <tr>
    let tableRow = event.target.parentElement.parentElement;
    let rowId = tableRow.id;
    let row = document.getElementById(rowId);

    // cycle through only ELEMENT nodes (given by .children)
    for (let child of row.children) {
        if (child.firstElementChild) {
            if (child.firstElementChild.tagName == 'INPUT' ||
                child.firstElementChild.tagName == 'SELECT') {

                    content = child.firstElementChild.value;
                    child.removeChild(child.firstElementChild);

                    if (originalContent) {
                        child.textContent = originalContent[child.getAttribute('name')]
                    } else {
                        child.textContent = content;
                    }

            } else if (child.firstElementChild.name == 'submit') {
                let editBtn = document.createElement('button');

                editBtn.name = 'edit';
                editBtn.textContent = 'Update';

                bindEdit(editBtn, dropdownData);
                child.replaceChild(editBtn, child.firstElementChild);

            } else if (child.firstElementChild.name == 'cancel') {
                let delBtn = document.createElement('button');

                delBtn.name = 'del';
                delBtn.textContent = 'Delete';

                bindDelete(delBtn);
                child.replaceChild(delBtn, child.firstElementChild);
            }
        }
    }
}


// TABLE FILTERS

// tablefilter object in global scope, to be accessed by other functions.
let tf
document.addEventListener('DOMContentLoaded', addFilters)

function addFilters () {
    const data_table = document.querySelector('table')
    console.log(data_table)
    tf = new TableFilterClass(data_table)
    tf.addTableFilter()
}

// Creating a tablefilter class
class TableFilterClass {
    constructor(tbl) {
        this.table = tbl
        this.tf = this.createTableFilter()
    }

    createTableFilter() {
        // Adds filter and sorting functionality to the given DOM table element.

        // Get the table header elements
        const tableHeaders = this.table.querySelector('tr').children
        // Determine num columns, and num that house buttons (header textContent = 'Update' or 'Delete').
        const numCols = tableHeaders.length
        let numButtons = 0
        for (let e of tableHeaders) {
            if (e.textContent == 'Update' || e.textContent == 'Delete') {
            numButtons++
            }
        }

        // Create filter config for the given table
        const filterConfig = {
            base_path: '../static/node_modules/tablefilter/dist/tablefilter/',
            extensions: [{ name: 'sort' }],
            btn_reset: {
            text: 'Clear Filters'
            },
            help_instructions: {
            text:
                'Click the header cells to sort the data.<br><br>' +
                'Use the drop-down menus to filter by individual values.<br>'
                ,
            btn_text: 'Help',
            load_filters_on_demand: true
            }
        }
        // Add the config for each column.
        // 'select' = dropdown. 'none' = no filter (button columns).
        for (let i = 0; i < numCols; i++) {
            if (i < numCols - numButtons) {
            filterConfig['col_' + i] = 'select'
            } else {
            filterConfig['col_' + i] = 'none'
            }
        }

        // Create the filter using the config, and return it
        tf = new TableFilter(this.table, filterConfig)
        return tf
    }

    addTableFilter() {
        // Initialize the table filter
        this.tf.init()
    }

    refreshFilters() {
        // Refresh table filter dropdowns
        const feature = this.tf.feature('dropdown')
        feature.refreshAll()
    }
}
