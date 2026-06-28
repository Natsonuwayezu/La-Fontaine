# Permissions & Access Control

See `backend.txt` Section 5 for full module block lists.

## Role Summary
| Module Category | Admin | Accountant | Teacher | Class Teacher |
|-----------------|-------|------------|---------|---------------|
| Dashboards      | ✅    | ✅ (own)   | ✅ (own) | ✅ (own)     |
| Marks Entry     | ✅    | ❌         | ✅ own subjects | ✅ all subjects for homeroom class |
| Class Register  | ✅    | 👁 read    | ✅ own classes | ✅ homeroom class |
| Attendance      | ✅    | ❌         | ❌      | ✅ homeroom class only |
| Class Timetable | ✅    | ❌         | ❌      | ✅ homeroom class |
| Student Enroll  | ✅    | ❌         | ❌      | ❌            |
| Finance (all)   | ✅    | ✅         | ❌      | ❌            |
| Staff Mgmt      | ✅    | ❌         | ❌      | ❌            |
| Settings        | ✅    | ❌         | ❌      | ❌            |

## Class Teacher Access
Stored as: `classes.class_teacher_id = teacher.id`
Grants access to: attendance, class-register, class-timetable,
marks-entry (all subjects), marks-database (read), student-list (read)

## Access Control Implementation
In loadModule(id):
  1. Check TEACHER_BLOCKED_MODULES Set
  2. Check ACCOUNTANT_BLOCKED_MODULES Set
  3. For class-teacher modules: check classes.class_teacher_id === user.id
  4. If blocked → show access denied message, do not render
