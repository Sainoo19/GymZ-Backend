const TrainingSession = require('../models/trainningSession');

/**
 * Check for scheduling conflicts for a user and employee
 * @param {String} userID - The user's ID
 * @param {String} employeeID - The employee's ID
 * @param {Date|String} date - The session date
 * @param {String} startHour - Start time in format 'HH:MM'
 * @param {String} endHour - End time in format 'HH:MM'
 * @param {String} [excludeSessionId] - Optional session ID to exclude from conflict check (useful for updates)
 * @returns {Object} Object containing conflict information
 */
async function checkSchedulingConflicts(userID, employeeID, date, startHour, endHour, excludeSessionId = null) {
    try {
        // Parse date
        const sessionDate = new Date(date);
        if (isNaN(sessionDate)) {
            throw new Error('Invalid date format');
        }

        // Convert time to minutes for comparison
        const [startHr, startMin] = startHour.split(':').map(Number);
        const [endHr, endMin] = endHour.split(':').map(Number);

        const startMinutes = startHr * 60 + startMin;
        const endMinutes = endHr * 60 + endMin;

        if (endMinutes <= startMinutes) {
            throw new Error('End time must be after start time');
        }

        // Format date to match date without time
        const formattedDate = sessionDate.toISOString().split('T')[0];

        // Prepare query filters
        const dateFilter = {
            $gte: new Date(`${formattedDate}T00:00:00.000Z`),
            $lt: new Date(`${formattedDate}T23:59:59.999Z`)
        };

        // Find any sessions for the user on the given date
        let userQuery = { userID: userID, date: dateFilter };
        let employeeQuery = { employeeID: employeeID, date: dateFilter };

        // Exclude the current session if updating
        if (excludeSessionId) {
            userQuery._id = { $ne: excludeSessionId };
            employeeQuery._id = { $ne: excludeSessionId };
        }

        const userSessions = await TrainingSession.find(userQuery);
        const employeeSessions = await TrainingSession.find(employeeQuery);

        // Check for conflicts
        const userConflicts = [];
        const employeeConflicts = [];

        // Check user conflicts
        for (const session of userSessions) {
            const [sessStartHr, sessStartMin] = session.startHour.split(':').map(Number);
            const [sessEndHr, sessEndMin] = session.endHour.split(':').map(Number);

            const sessStartMinutes = sessStartHr * 60 + sessStartMin;
            const sessEndMinutes = sessEndHr * 60 + sessEndMin;

            // Check for overlap
            if ((startMinutes >= sessStartMinutes && startMinutes < sessEndMinutes) ||
                (endMinutes > sessStartMinutes && endMinutes <= sessEndMinutes) ||
                (startMinutes <= sessStartMinutes && endMinutes >= sessEndMinutes)) {
                userConflicts.push({
                    sessionId: session._id,
                    startHour: session.startHour,
                    endHour: session.endHour,
                    date: session.date
                });
            }
        }

        // Check employee conflicts
        for (const session of employeeSessions) {
            const [sessStartHr, sessStartMin] = session.startHour.split(':').map(Number);
            const [sessEndHr, sessEndMin] = session.endHour.split(':').map(Number);

            const sessStartMinutes = sessStartHr * 60 + sessStartMin;
            const sessEndMinutes = sessEndHr * 60 + sessEndMin;

            // Check for overlap
            if ((startMinutes >= sessStartMinutes && startMinutes < sessEndMinutes) ||
                (endMinutes > sessStartMinutes && endMinutes <= sessEndMinutes) ||
                (startMinutes <= sessStartMinutes && endMinutes >= sessEndMinutes)) {
                employeeConflicts.push({
                    sessionId: session._id,
                    userID: session.userID,
                    startHour: session.startHour,
                    endHour: session.endHour,
                    date: session.date
                });
            }
        }

        // Prepare response
        const hasConflicts = userConflicts.length > 0 || employeeConflicts.length > 0;

        return {
            hasConflicts,
            userConflicts,
            employeeConflicts
        };
    } catch (error) {
        throw error;
    }
}

module.exports = { checkSchedulingConflicts };