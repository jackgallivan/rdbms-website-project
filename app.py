"""
Flask app to power NASA RDMS front-end.

Authors: Richie Stuver and Jack Gallivan
Date Created: 05-18-21
"""

import re
from flask import Flask, json, render_template, request, abort
import os
from urllib.parse import urlparse
import database.db_connector as db


# Config

app = Flask(__name__)
db_connection = db.connect_to_database()


# Routes

# GET Handlers

@app.route("/")
def root():
    return render_template("index.j2")

@app.route("/devices")
def devices_route():
    query = ("SELECT deviceID, deviceName, dateLaunched, manufacturer, locationName, missionName "
             "FROM devices "
             "JOIN locations ON devices.locationID = locations.locationID "
             "LEFT JOIN missions ON devices.missionID = missions.missionID;")
    cursor = db.execute_query(db_connection=db_connection, query=query)
    results = cursor.fetchall()
    return render_template("devices.j2", data=results)

@app.route("/functions")
def functions_route():
    query = ("SELECT functionID, functionName, description "
             "FROM functions;")
    cursor = db.execute_query(db_connection=db_connection, query=query)
    results = cursor.fetchall()
    return render_template("functions.j2", data=results)

@app.route("/device_function")
def device_function_route():
    query = ("SELECT deviceName, functionName FROM device_function "
             "JOIN devices ON device_function.deviceID = devices.deviceID "
             "JOIN functions ON device_function.functionID = functions.functionID;")
    cursor = db.execute_query(db_connection=db_connection, query=query)
    results = cursor.fetchall()
    return render_template("device_function.j2", data=results)

@app.route("/missions")
def missions_route():
    query = ("SELECT missionID, missionName, objective, locationName "
             "FROM missions JOIN locations ON missions.locationID = locations.locationID;")
    cursor = db.execute_query(db_connection=db_connection, query=query)
    results = cursor.fetchall()
    return render_template("missions.j2", data=results)

@app.route("/locations")
def locations_route():
    query = ("SELECT locationID, locationName, localsystem, localBody "
             "FROM locations;")
    cursor = db.execute_query(db_connection=db_connection, query=query)
    results = cursor.fetchall()
    return render_template("locations.j2", data=results)

@app.route("/operators")
def operators_route():
    query = ("SELECT operatorID, operatorName, deviceName "
             "FROM operators "
             "LEFT JOIN devices ON operators.deviceID = devices.deviceID;")
    cursor = db.execute_query(db_connection=db_connection, query=query)
    results = cursor.fetchall()
    return render_template("operators.j2", data=results)

@app.route("/get-dropdown-data", methods=["POST"])
def get_dropdown_data():
    """
    hit this endpoint to retrieve data for dropdown menus
    TODO: have method figure out which page made the request.
    TODO: send the correct query based on the correct page
    """

    valid_dropdowns = {"locationName": "SELECT locationName FROM locations;",
                       "missionName": "SELECT missionName FROM missions;",
                       "deviceName": "SELECT deviceName FROM devices;",
                       "functionName": "SELECT functionName FROM functions;"}

    dropdowns = request.get_json()
    referrer_path = urlparse(request.referrer).path
    results = {}

    for dropdown in dropdowns:
        if dropdown in valid_dropdowns:

            query = valid_dropdowns[dropdown]
            cursor = db.execute_query(db_connection=db_connection, query=query)
            results[dropdown] = cursor.fetchall()

            # device page and missionID must be nullable
            if referrer_path == '/devices' and dropdown == 'missionName' \
                or referrer_path == '/operators' and dropdown == 'deviceName':

                results[dropdown].append({dropdown: ''})

    return (json.jsonify(results), 200)

@app.route("/reset")
def reset_db():
    """
    Reset the NASA RDMS database
    """

    with open("database/load_db.sql", 'r') as file:
        multi_cursor = db_connection.cursor()
        for result in multi_cursor.execute(file.read(), multi=True):
            result.fetchall()
        db_connection.commit()
        multi_cursor.close()

    return "Reset successful!"


# POST Handlers

@app.route("/add-data", methods=['POST'])
def add_data():
    """
    Accessed for INSERT DB operations.
    """
    print("Accessing /add-data route")
    results = {}

    # Get the data in the request object (to be added to a table)
    # and the referrer_path, which is the page we are requesting from.
    data = request.get_json()
    print("data: ")
    print(data)
    referrer_path = urlparse(request.referrer).path
    print("referer_path: " + referrer_path)

    # Create the INSERT query, dependent on the referrer_path
    if referrer_path == '/devices':
        query = ("INSERT INTO devices (deviceName, dateLaunched, manufacturer, locationID, missionID) "
                 "VALUES (%(deviceName)s, "
                 "%(dateLaunched)s, "
                 "%(manufacturer)s, "
                 "(SELECT locationID FROM locations WHERE locationName = %(locationName)s), "
                 "(SELECT missionID FROM missions WHERE missionName = %(missionName)s) "
                 ");")
        results['id'] = ['deviceID']

    elif referrer_path == '/functions':
        query = ("INSERT INTO functions (functionName, description) "
                 "VALUES (%(functionName)s, %(description)s);")
        results['id'] = ['functionID']

    elif referrer_path == '/device_function':
        query = ("INSERT INTO device_function (deviceID, functionID) "
                 "VALUES ((SELECT deviceID FROM devices WHERE deviceName = %(deviceName)s), "
                 "(SELECT functionID FROM functions WHERE functionName = %(functionName)s) "
                 ");")
        results['id'] = False

    elif referrer_path == '/missions':
        query = ("INSERT INTO missions (missionName, objective, locationID) "
                 "VALUES (%(missionName)s, "
                 "%(objective)s, "
                 "(SELECT locationID FROM locations WHERE locationName = %(locationName)s) "
                 ");")
        results['id'] = ['missionID']

    elif referrer_path == '/locations':
        query = ("INSERT INTO locations (locationName, localSystem, localBody) "
                 "VALUES (%(locationName)s, %(localSystem)s, %(localBody)s);")
        results['id'] = ['locationID']

    elif referrer_path == '/operators':
        query = ("INSERT INTO operators (operatorName, deviceID) "
                 "VALUES (%(operatorName)s, "
                 "(SELECT deviceID FROM devices WHERE deviceName = %(deviceName)s) "
                 ");")
        results['id'] = ['operatorID']

    else:
        abort(500)

    # Execute the query, then check that a row was added.
    cursor = db.execute_query(db_connection=db_connection, query=query, query_params=data)
    if cursor.rowcount == 0:
        # ERROR: no row inserted
        abort(500)

    if results['id']:
        results['id'].append(cursor.lastrowid)

    return (json.jsonify(results), 200)

@app.route("/delete-data", methods=['POST'])
def delete_data():
    print("Accessing /delete-data route")
    # Get the data from the request object (to be removed from the table)
    # and the referrer_path, which is the page we are requesting from.
    data = request.get_json()
    print("data: ")
    print(data)
    referrer_path = urlparse(request.referrer).path
    print("referer_path: " + referrer_path)
    # Create the DELETE query, dependent on the referrer_path
    if referrer_path == '/devices':
        query = ("DELETE FROM devices "
                 "WHERE deviceID = %(deviceID)s;")

    elif referrer_path == '/functions':
        query = ("DELETE FROM functions "
                 "WHERE functionID = %(functionID)s;")

    elif referrer_path == '/device_function':
        query = ("DELETE FROM device_function "
                 "WHERE deviceID = (SELECT deviceID FROM devices WHERE deviceName = %(deviceName)s) "
                 "AND functionID = (SELECT functionID FROM functions WHERE functionName = %(functionName)s);")

    elif referrer_path == '/missions':
        query = ("DELETE FROM missions "
                 "WHERE missionID = %(missionID)s;")

    elif referrer_path == '/locations':
        query = ("DELETE FROM locations "
                 "WHERE locationID = %(locationID)s;")

    elif referrer_path == '/operators':
        query = ("DELETE FROM operators "
                 "WHERE operatorID = %(operatorID)s;")

    else:
        abort(500)
    # Execute the query, then check that a row was deleted.
    cursor = db.execute_query(db_connection=db_connection, query=query, query_params=data)
    results = {}
    if cursor.rowcount == 0:
        # ERROR: no row deleted
        abort(500)
    return (json.jsonify(results), 200)

@app.route('/update-data', methods=['PUT'])
def update_data():
    """edit a single row from a given table."""

    data = request.get_json()
    referrer_path = urlparse(request.referrer).path

    if data:
        print(data)

        if referrer_path == '/devices':
            query = ("UPDATE devices "
                     "SET deviceName = %(deviceName)s, "
                     "dateLaunched = %(dateLaunched)s, "
                     "manufacturer = %(manufacturer)s, "
                     "locationID = (SELECT locationID FROM locations WHERE locationName = %(locationName)s), "
                     "missionID = (SELECT missionID FROM missions WHERE missionName = %(missionName)s) "
                     "WHERE deviceID = %(deviceID)s;")

        elif referrer_path == '/functions':
            query = ("UPDATE functions "
                     "SET functionName = %(functionName)s, description = %(description)s "
                     "WHERE functionID = %(functionID)s;")

        elif referrer_path == '/operators':
            query = ("UPDATE operators "
                     "SET operatorName = %(operatorName)s, "
                     "deviceID = (SELECT deviceID FROM devices WHERE deviceName = %(deviceName)s) "
                     "WHERE operatorID = %(operatorID)s;")

        elif referrer_path == '/locations':
            query = ("UPDATE locations "
                     "SET locationName = %(locationName)s, localSystem = %(localsystem)s, localBody = %(localBody)s "
                     "WHERE locationID = %(locationID)s;")

        elif referrer_path == '/missions':
            query = ("UPDATE missions "
                     "SET missionName = %(missionName)s, "
                     "objective = %(objective)s, "
                     "locationID = (SELECT locationID FROM locations WHERE locationName = %(locationName)s) "
                     "WHERE missionID = %(missionID)s;")

    else:
        abort(500)

    # Execute the query, then check that a row was added.
    cursor = db.execute_query(db_connection=db_connection, query=query, query_params=data)
    results = {}
    results['id'] = cursor.lastrowid
    if cursor.rowcount == 0:
        # ERROR: no row inserted
        print("update failed bro")
        abort(500)

    return (str(referrer_path) + ": updated id " + json.dumps(data['id']), 200)

# Error Handlers

@app.errorhandler(404)
def not_found(error):
    return ("404: page not found", 404)

@app.errorhandler(500)
def server_error(error):
    return ("500: Internal server error", 500)


# Listener

if __name__ == "__main__":
    port = int(os.environ.get('PORT', 3000))
    app.run(port=port, debug=True)
