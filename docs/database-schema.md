
# Database Schema - Supabase PostgreSQL

## Core Tables

### students
```sql
CREATE TABLE students (
    id BIGSERIAL PRIMARY KEY,
    student_code VARCHAR(20) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    class_id BIGINT REFERENCES classes(id),
    gender VARCHAR(10),
    date_of_birth DATE,
    nationality VARCHAR(50),
    guardian_name VARCHAR(200),
    guardian_phone VARCHAR(20),
    guardian_email VARCHAR(100),
    enrollment_date DATE,
    status VARCHAR(20) DEFAULT 'Active',
    is_deleted BOOLEAN DEFAULT false,
    notes TEXT,
    family_id BIGINT REFERENCES families(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP
);

CREATE INDEX idx_students_class ON students(class_id);
CREATE INDEX idx_students_code ON students(student_code);
CREATE INDEX idx_students_status ON students(status);
```

### teachers
```sql
CREATE TABLE teachers (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    email VARCHAR(100) UNIQUE,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(100) NOT NULL,
    role VARCHAR(20) DEFAULT 'teacher',
    phone VARCHAR(20),
    department VARCHAR(100),
    qualification TEXT,
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP
);

CREATE INDEX idx_teachers_role ON teachers(role);
CREATE INDEX idx_teachers_username ON teachers(username);
```

### classes
```sql
CREATE TABLE classes (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    code VARCHAR(10) UNIQUE NOT NULL,
    level VARCHAR(20) NOT NULL,
    capacity INTEGER DEFAULT 40,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### subjects
```sql
CREATE TABLE subjects (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    level VARCHAR(20) NOT NULL,
    mg_max INTEGER DEFAULT 50,
    ex_max INTEGER DEFAULT 50,
    appears_only_post_midterm BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### terms
```sql
CREATE TABLE terms (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    academic_year_id BIGINT REFERENCES academic_years(id),
    term_number INTEGER,
    start_date DATE,
    end_date DATE,
    midterm_date DATE,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### academic_years
```sql
CREATE TABLE academic_years (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    start_date DATE,
    end_date DATE,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## Academic Tables

### assessments
```sql
CREATE TABLE assessments (
    id BIGSERIAL PRIMARY KEY,
    class_id BIGINT REFERENCES classes(id),
    subject_id BIGINT REFERENCES subjects(id),
    term_id BIGINT REFERENCES terms(id),
    academic_year_id BIGINT REFERENCES academic_years(id),
    assessment_type VARCHAR(30) NOT NULL,
    assessment_name VARCHAR(200) NOT NULL,
    max_marks INTEGER NOT NULL,
    date DATE,
    due_date DATE,
    is_locked BOOLEAN DEFAULT false,
    created_by BIGINT REFERENCES teachers(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP
);

CREATE INDEX idx_assessments_class ON assessments(class_id);
CREATE INDEX idx_assessments_subject ON assessments(subject_id);
CREATE INDEX idx_assessments_term ON assessments(term_id);
```

### marks
```sql
CREATE TABLE marks (
    id BIGSERIAL PRIMARY KEY,
    assessment_id BIGINT REFERENCES assessments(id) ON DELETE CASCADE,
    student_id BIGINT REFERENCES students(id),
    score DECIMAL(10,2) NOT NULL,
    entered_by BIGINT REFERENCES teachers(id),
    entered_at TIMESTAMP DEFAULT NOW(),
    synced BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_marks_assessment ON marks(assessment_id);
CREATE INDEX idx_marks_student ON marks(student_id);
```

## Financial Tables

### fee_categories
```sql
CREATE TABLE fee_categories (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    fee_type VARCHAR(50),
    amount DECIMAL(15,2),
    reset_frequency VARCHAR(20) DEFAULT 'one_time',
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP
);
```

### fee_amounts
```sql
CREATE TABLE fee_amounts (
    id BIGSERIAL PRIMARY KEY,
    class_id BIGINT REFERENCES classes(id),
    fee_category_id BIGINT REFERENCES fee_categories(id),
    academic_year_id BIGINT REFERENCES academic_years(id),
    amount DECIMAL(15,2) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP,
    UNIQUE(class_id, fee_category_id, academic_year_id)
);
```

### student_fees
```sql
CREATE TABLE student_fees (
    id BIGSERIAL PRIMARY KEY,
    student_id BIGINT REFERENCES students(id),
    fee_category_id BIGINT REFERENCES fee_categories(id),
    term_id BIGINT REFERENCES terms(id),
    academic_year_id BIGINT REFERENCES academic_years(id),
    amount DECIMAL(15,2) NOT NULL,
    paid_amount DECIMAL(15,2) DEFAULT 0,
    is_paid BOOLEAN DEFAULT false,
    is_waived BOOLEAN DEFAULT false,
    is_credit BOOLEAN DEFAULT false,
    credit_amount DECIMAL(15,2) DEFAULT 0,
    due_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP
);

CREATE INDEX idx_student_fees_student ON student_fees(student_id);
CREATE INDEX idx_student_fees_term ON student_fees(term_id);
```

### payments
```sql
CREATE TABLE payments (
    id BIGSERIAL PRIMARY KEY,
    student_id BIGINT REFERENCES students(id),
    amount DECIMAL(15,2) NOT NULL,
    payment_date DATE NOT NULL,
    payment_method VARCHAR(50),
    receipt_number VARCHAR(50) UNIQUE,
    reference VARCHAR(100),
    notes TEXT,
    recorded_by BIGINT REFERENCES teachers(id),
    is_credit_payment BOOLEAN DEFAULT false,
    is_credit_addition BOOLEAN DEFAULT false,
    is_refund BOOLEAN DEFAULT false,
    is_reversed BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_payments_student ON payments(student_id);
CREATE INDEX idx_payments_receipt ON payments(receipt_number);
CREATE INDEX idx_payments_date ON payments(payment_date);
```

### payment_allocations
```sql
CREATE TABLE payment_allocations (
    id BIGSERIAL PRIMARY KEY,
    payment_id BIGINT REFERENCES payments(id),
    student_fee_id BIGINT REFERENCES student_fees(id),
    amount DECIMAL(15,2) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## Family & Relationships

### families
```sql
CREATE TABLE families (
    id BIGSERIAL PRIMARY KEY,
    family_code VARCHAR(20) UNIQUE NOT NULL,
    guardian_name VARCHAR(200),
    guardian_phone VARCHAR(20),
    guardian_email VARCHAR(100),
    address TEXT,
    discount_amount DECIMAL(15,2) DEFAULT 0,
    discount_type VARCHAR(20) DEFAULT 'fixed',
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP
);
```

### teacher_assignments
```sql
CREATE TABLE teacher_assignments (
    id BIGSERIAL PRIMARY KEY,
    teacher_id BIGINT REFERENCES teachers(id),
    class_id BIGINT REFERENCES classes(id),
    subject_id BIGINT REFERENCES subjects(id),
    academic_year_id BIGINT REFERENCES academic_years(id),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(teacher_id, class_id, subject_id, academic_year_id)
);
```

## Timetable

### timetable_slots
```sql
CREATE TABLE timetable_slots (
    id BIGSERIAL PRIMARY KEY,
    day VARCHAR(20) NOT NULL,
    time_slot VARCHAR(20) NOT NULL,
    class_id BIGINT REFERENCES classes(id),
    subject_id BIGINT REFERENCES subjects(id),
    teacher_id BIGINT REFERENCES teachers(id),
    room VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP
);

CREATE INDEX idx_timetable_class ON timetable_slots(class_id);
CREATE INDEX idx_timetable_teacher ON timetable_slots(teacher_id);
```

## System Tables

### school_settings
```sql
CREATE TABLE school_settings (
    id BIGSERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT,
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### activity_logs
```sql
CREATE TABLE activity_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT,
    user_role VARCHAR(20),
    action TEXT NOT NULL,
    entity_type VARCHAR(50),
    entity_id BIGINT,
    details JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_logs_user ON activity_logs(user_id);
CREATE INDEX idx_logs_created ON activity_logs(created_at);
```

### announcements
```sql
CREATE TABLE announcements (
    id BIGSERIAL PRIMARY KEY,
    type VARCHAR(20) DEFAULT 'general',
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    recipients VARCHAR(50) DEFAULT 'all',
    specific_teacher_id BIGINT REFERENCES teachers(id),
    status VARCHAR(20) DEFAULT 'sent',
    created_by BIGINT REFERENCES teachers(id),
    send_email BOOLEAN DEFAULT false,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP
);
```

### holidays
```sql
CREATE TABLE holidays (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    type VARCHAR(30),
    description TEXT,
    academic_year_id BIGINT REFERENCES academic_years(id),
    created_at TIMESTAMP DEFAULT NOW()
);
```

### grading_scale
```sql
CREATE TABLE grading_scale (
    id BIGSERIAL PRIMARY KEY,
    grade VARCHAR(5) NOT NULL,
    min_percentage INTEGER NOT NULL,
    max_percentage INTEGER NOT NULL,
    description VARCHAR(100),
    color VARCHAR(20),
    sort_order INTEGER DEFAULT 0
);
```

### promotions
```sql
CREATE TABLE promotions (
    id BIGSERIAL PRIMARY KEY,
    batch_name VARCHAR(100),
    promotion_date DATE,
    promoted_count INTEGER,
    graduated_count INTEGER,
    performed_by BIGINT REFERENCES teachers(id),
    details JSONB,
    rolled_back BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## Security Notes

### Row Level Security (RLS) Recommended Policies

```sql
-- Enable RLS on all tables
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_fees ENABLE ROW LEVEL SECURITY;

-- Example policies
CREATE POLICY admin_all ON students TO authenticated 
    USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY teacher_view ON students TO authenticated 
    USING (auth.jwt() ->> 'role' = 'teacher');
```

## Initial Seed Data

```sql
-- Default admin user (password: admin123)
INSERT INTO teachers (name, email, username, password, role, is_active)
VALUES ('Administrator', 'admin@school.com', 'admin', 'admin123', 'admin', true);

-- Default grading scale
INSERT INTO grading_scale (grade, min_percentage, max_percentage, description, sort_order)
VALUES 
    ('A+', 90, 100, 'Excellent', 1),
    ('A', 80, 89, 'Very Good', 2),
    ('B', 70, 79, 'Good', 3),
    ('C', 60, 69, 'Average', 4),
    ('D', 50, 59, 'Below Average', 5),
    ('F', 0, 49, 'Fail', 6);
```
