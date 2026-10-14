// NexClass HOD Portal — Mock Data
// Single source of truth for all app data
// Replace with real API calls when backend is ready

export const HOD = {
  name: "Dr. Rajesh Kumar",
  initials: "RK",
  department: "Computer Science & Engineering",
  departmentCode: "CSE",
  university: "Bangalore Institute of Technology",
  email: "hod.cse@nexclass.demo",
  employeeId: "BIT-HOD-001",
  joinedDate: "2018-07-01",
  phone: "+91 00000 00000"
}

export const TEACHERS = [
  {
    id: 1,
    name: "Prof. Priya Sharma",
    initials: "PS",
    employeeId: "BIT-T-001",
    email: "teacher1@nexclass.demo",
    subject: "Data Structures",
    semester: 3,
    status: "approved",
    joinedDate: "2024-07-01",
    lastActive: "2026-10-08",
    totalClasses: 24,
    avgDuration: 52,
    totalStudentsTaught: 42,
    totalNotesPushed: 18,
    sessions: [
      {
        id: 1,
        roomCode: "CS3A01",
        subject: "Data Structures",
        date: "2026-10-08",
        duration: 55,
        studentsPresent: 38,
        totalStudents: 42,
        notesCount: 3,
        examsConducted: 1
      },
      {
        id: 2,
        roomCode: "CS3A02",
        subject: "Data Structures",
        date: "2026-10-06",
        duration: 50,
        studentsPresent: 40,
        totalStudents: 42,
        notesCount: 2,
        examsConducted: 0
      },
      {
        id: 3,
        roomCode: "CS3A03",
        subject: "Data Structures",
        date: "2026-10-03",
        duration: 48,
        studentsPresent: 35,
        totalStudents: 42,
        notesCount: 4,
        examsConducted: 1
      },
      {
        id: 4,
        roomCode: "CS3A04",
        subject: "Data Structures",
        date: "2026-09-30",
        duration: 52,
        studentsPresent: 41,
        totalStudents: 42,
        notesCount: 2,
        examsConducted: 0
      },
      {
        id: 5,
        roomCode: "CS3A05",
        subject: "Data Structures",
        date: "2026-09-27",
        duration: 55,
        studentsPresent: 39,
        totalStudents: 42,
        notesCount: 3,
        examsConducted: 0
      }
    ],
    examsConducted: [
      {
        id: 1,
        title: "Binary Trees Unit Test",
        date: "2026-10-08",
        avgScore: 76,
        totalStudents: 42,
        highestScore: 98,
        lowestScore: 42
      },
      {
        id: 2,
        title: "Sorting Algorithms Quiz",
        date: "2026-10-03",
        avgScore: 70,
        totalStudents: 42,
        highestScore: 95,
        lowestScore: 38
      },
      {
        id: 3,
        title: "Mid Semester Exam",
        date: "2026-09-05",
        avgScore: 72,
        totalStudents: 42,
        highestScore: 96,
        lowestScore: 35
      }
    ]
  },
  {
    id: 2,
    name: "Prof. Arjun Nair",
    initials: "AN",
    employeeId: "BIT-T-002",
    email: "teacher2@nexclass.demo",
    subject: "Database Management",
    semester: 4,
    status: "approved",
    joinedDate: "2024-07-01",
    lastActive: "2026-10-07",
    totalClasses: 18,
    avgDuration: 48,
    totalStudentsTaught: 38,
    totalNotesPushed: 12,
    sessions: [
      {
        id: 6,
        roomCode: "CS4B01",
        subject: "Database Management",
        date: "2026-10-07",
        duration: 50,
        studentsPresent: 35,
        totalStudents: 38,
        notesCount: 2,
        examsConducted: 0
      },
      {
        id: 7,
        roomCode: "CS4B02",
        subject: "Database Management",
        date: "2026-10-04",
        duration: 45,
        studentsPresent: 33,
        totalStudents: 38,
        notesCount: 1,
        examsConducted: 1
      },
      {
        id: 8,
        roomCode: "CS4B03",
        subject: "Database Management",
        date: "2026-10-01",
        duration: 50,
        studentsPresent: 36,
        totalStudents: 38,
        notesCount: 2,
        examsConducted: 0
      }
    ],
    examsConducted: [
      {
        id: 4,
        title: "SQL Quiz",
        date: "2026-09-25",
        avgScore: 81,
        totalStudents: 38,
        highestScore: 100,
        lowestScore: 52
      }
    ]
  },
  {
    id: 3,
    name: "Prof. Sneha Verma",
    initials: "SV",
    employeeId: "BIT-T-003",
    email: "teacher3@nexclass.demo",
    subject: "Web Development",
    semester: 5,
    status: "approved",
    joinedDate: "2024-07-01",
    lastActive: "2026-10-09",
    totalClasses: 20,
    avgDuration: 55,
    totalStudentsTaught: 30,
    totalNotesPushed: 22,
    sessions: [
      {
        id: 9,
        roomCode: "CS5C01",
        subject: "Web Development",
        date: "2026-10-09",
        duration: 60,
        studentsPresent: 28,
        totalStudents: 30,
        notesCount: 4,
        examsConducted: 1
      },
      {
        id: 10,
        roomCode: "CS5C02",
        subject: "Web Development",
        date: "2026-10-05",
        duration: 55,
        studentsPresent: 29,
        totalStudents: 30,
        notesCount: 3,
        examsConducted: 0
      }
    ],
    examsConducted: [
      {
        id: 5,
        title: "React Fundamentals Quiz",
        date: "2026-10-09",
        avgScore: 82,
        totalStudents: 30,
        highestScore: 98,
        lowestScore: 58
      }
    ]
  },
  {
    id: 4,
    name: "Prof. Kiran Rao",
    initials: "KR",
    employeeId: "BIT-T-004",
    email: "teacher4@nexclass.demo",
    subject: "Machine Learning",
    semester: 6,
    status: "pending",
    joinedDate: "2026-10-01",
    lastActive: null,
    totalClasses: 0,
    avgDuration: 0,
    totalStudentsTaught: 0,
    totalNotesPushed: 0,
    sessions: [],
    examsConducted: []
  },
  {
    id: 5,
    name: "Prof. Divya Menon",
    initials: "DM",
    employeeId: "BIT-T-005",
    email: "teacher5@nexclass.demo",
    subject: "Operating Systems",
    semester: 3,
    status: "pending",
    joinedDate: "2026-10-05",
    lastActive: null,
    totalClasses: 0,
    avgDuration: 0,
    totalStudentsTaught: 0,
    totalNotesPushed: 0,
    sessions: [],
    examsConducted: []
  }
]

export const STUDENTS = [

  // ── SEMESTER 3 (4 students) ──────────────────────────
  {
    id: 1,
    name: "Aarav Mehta",
    initials: "AM",
    usn: "1BI23MCA001",
    semester: 3,
    email: "student1@nexclass.demo",
    joinedDate: "2023-08-01",
    codeSubmissions: 12,
    rank: 1,
    attendance: {
      overall: 92,
      subjects: [
        {
          subject: "Data Structures",
          held: 24, present: 22,
          absent: 2, late: 0, pct: 92
        },
        {
          subject: "Mathematics",
          held: 20, present: 19,
          absent: 1, late: 0, pct: 95
        },
        {
          subject: "Python Programming",
          held: 18, present: 16,
          absent: 2, late: 0, pct: 89
        }
      ]
    },
    exams: [
      {
        title: "Binary Trees Unit Test",
        subject: "Data Structures",
        date: "2026-10-08",
        score: 88, total: 100
      },
      {
        title: "Math Mid Semester",
        subject: "Mathematics",
        date: "2026-09-15",
        score: 92, total: 100
      },
      {
        title: "Python Quiz",
        subject: "Python Programming",
        date: "2026-09-10",
        score: 76, total: 100
      }
    ],
    badges: ["Attendance Star", "Exam Ace", "Coding Champ"]
  },
  {
    id: 2,
    name: "Priya Nair",
    initials: "PN",
    usn: "1BI23MCA002",
    semester: 3,
    email: "student2@nexclass.demo",
    joinedDate: "2023-08-01",
    codeSubmissions: 2,
    rank: 10,
    attendance: {
      overall: 68,
      subjects: [
        {
          subject: "Data Structures",
          held: 24, present: 16,
          absent: 8, late: 0, pct: 67
        },
        {
          subject: "Mathematics",
          held: 20, present: 14,
          absent: 6, late: 0, pct: 70
        },
        {
          subject: "Python Programming",
          held: 18, present: 12,
          absent: 6, late: 0, pct: 67
        }
      ]
    },
    exams: [
      {
        title: "Binary Trees Unit Test",
        subject: "Data Structures",
        date: "2026-10-08",
        score: 55, total: 100
      },
      {
        title: "Math Mid Semester",
        subject: "Mathematics",
        date: "2026-09-15",
        score: 60, total: 100
      }
    ],
    badges: []
  },
  {
    id: 3,
    name: "Rohan Kumar",
    initials: "RK",
    usn: "1BI23MCA003",
    semester: 3,
    email: "student3@nexclass.demo",
    joinedDate: "2023-08-01",
    codeSubmissions: 8,
    rank: 3,
    attendance: {
      overall: 85,
      subjects: [
        {
          subject: "Data Structures",
          held: 24, present: 20,
          absent: 4, late: 0, pct: 83
        },
        {
          subject: "Mathematics",
          held: 20, present: 17,
          absent: 3, late: 0, pct: 85
        },
        {
          subject: "Python Programming",
          held: 18, present: 16,
          absent: 2, late: 0, pct: 89
        }
      ]
    },
    exams: [
      {
        title: "Binary Trees Unit Test",
        subject: "Data Structures",
        date: "2026-10-08",
        score: 80, total: 100
      },
      {
        title: "Python Quiz",
        subject: "Python Programming",
        date: "2026-09-10",
        score: 85, total: 100
      }
    ],
    badges: ["Attendance Star", "Coding Champ"]
  },
  {
    id: 4,
    name: "Sneha Patil",
    initials: "SP",
    usn: "1BI23MCA004",
    semester: 3,
    email: "student4@nexclass.demo",
    joinedDate: "2023-08-01",
    codeSubmissions: 1,
    rank: 12,
    attendance: {
      overall: 55,
      subjects: [
        {
          subject: "Data Structures",
          held: 24, present: 13,
          absent: 11, late: 0, pct: 54
        },
        {
          subject: "Mathematics",
          held: 20, present: 11,
          absent: 9, late: 0, pct: 55
        },
        {
          subject: "Python Programming",
          held: 18, present: 10,
          absent: 8, late: 0, pct: 56
        }
      ]
    },
    exams: [
      {
        title: "Binary Trees Unit Test",
        subject: "Data Structures",
        date: "2026-10-08",
        score: 42, total: 100
      }
    ],
    badges: []
  },

  // ── SEMESTER 4 (3 students) ──────────────────────────
  {
    id: 5,
    name: "Arjun Singh",
    initials: "AS",
    usn: "1BI22MCA001",
    semester: 4,
    email: "student5@nexclass.demo",
    joinedDate: "2022-08-01",
    codeSubmissions: 15,
    rank: 1,
    attendance: {
      overall: 90,
      subjects: [
        {
          subject: "Database Management",
          held: 18, present: 16,
          absent: 2, late: 0, pct: 89
        },
        {
          subject: "Computer Networks",
          held: 16, present: 15,
          absent: 1, late: 0, pct: 94
        }
      ]
    },
    exams: [
      {
        title: "SQL Quiz",
        subject: "Database Management",
        date: "2026-09-25",
        score: 90, total: 100
      },
      {
        title: "Networks Unit Test",
        subject: "Computer Networks",
        date: "2026-09-18",
        score: 88, total: 100
      }
    ],
    badges: [
      "Attendance Star", "Exam Ace",
      "Perfect Score", "Coding Champ"
    ]
  },
  {
    id: 6,
    name: "Divya Rao",
    initials: "DR",
    usn: "1BI22MCA002",
    semester: 4,
    email: "student6@nexclass.demo",
    joinedDate: "2022-08-01",
    codeSubmissions: 5,
    rank: 4,
    attendance: {
      overall: 78,
      subjects: [
        {
          subject: "Database Management",
          held: 18, present: 14,
          absent: 4, late: 0, pct: 78
        },
        {
          subject: "Computer Networks",
          held: 16, present: 12,
          absent: 4, late: 0, pct: 75
        }
      ]
    },
    exams: [
      {
        title: "SQL Quiz",
        subject: "Database Management",
        date: "2026-09-25",
        score: 72, total: 100
      }
    ],
    badges: ["Attendance Star"]
  },
  {
    id: 7,
    name: "Karan Verma",
    initials: "KV",
    usn: "1BI22MCA003",
    semester: 4,
    email: "student7@nexclass.demo",
    joinedDate: "2022-08-01",
    codeSubmissions: 3,
    rank: 7,
    attendance: {
      overall: 62,
      subjects: [
        {
          subject: "Database Management",
          held: 18, present: 11,
          absent: 7, late: 0, pct: 61
        },
        {
          subject: "Computer Networks",
          held: 16, present: 10,
          absent: 6, late: 0, pct: 63
        }
      ]
    },
    exams: [
      {
        title: "SQL Quiz",
        subject: "Database Management",
        date: "2026-09-25",
        score: 58, total: 100
      }
    ],
    badges: []
  },

  // ── SEMESTER 5 (2 students) ──────────────────────────
  {
    id: 8,
    name: "Ananya Iyer",
    initials: "AI",
    usn: "1BI21MCA001",
    semester: 5,
    email: "student8@nexclass.demo",
    joinedDate: "2021-08-01",
    codeSubmissions: 22,
    rank: 1,
    attendance: {
      overall: 95,
      subjects: [
        {
          subject: "Web Development",
          held: 20, present: 19,
          absent: 1, late: 0, pct: 95
        },
        {
          subject: "Artificial Intelligence",
          held: 18, present: 17,
          absent: 1, late: 0, pct: 94
        }
      ]
    },
    exams: [
      {
        title: "React Fundamentals Quiz",
        subject: "Web Development",
        date: "2026-10-09",
        score: 96, total: 100
      },
      {
        title: "AI Unit Test",
        subject: "Artificial Intelligence",
        date: "2026-09-12",
        score: 94, total: 100
      }
    ],
    badges: [
      "Attendance Star", "Exam Ace",
      "Perfect Score", "Top Performer",
      "Coding Champ", "Fast Learner"
    ]
  },
  {
    id: 9,
    name: "Vikram Bose",
    initials: "VB",
    usn: "1BI21MCA002",
    semester: 5,
    email: "student9@nexclass.demo",
    joinedDate: "2021-08-01",
    codeSubmissions: 4,
    rank: 5,
    attendance: {
      overall: 71,
      subjects: [
        {
          subject: "Web Development",
          held: 20, present: 14,
          absent: 6, late: 0, pct: 70
        },
        {
          subject: "Artificial Intelligence",
          held: 18, present: 13,
          absent: 5, late: 0, pct: 72
        }
      ]
    },
    exams: [
      {
        title: "React Fundamentals Quiz",
        subject: "Web Development",
        date: "2026-10-09",
        score: 65, total: 100
      }
    ],
    badges: []
  }
]

export const SESSION_LOGS = [
  {
    id: 1,
    roomCode: "CS3A01",
    subject: "Data Structures",
    teacher: "Prof. Priya Sharma",
    teacherId: 1,
    semester: 3,
    date: "2026-10-09",
    duration: 55,
    studentsPresent: 38,
    totalStudents: 42,
    status: "completed",
    notesCount: 3,
    examsConducted: 1,
    attendance: [
      { usn:"1BI23MCA001", name:"Aarav Mehta",  status:"present" },
      { usn:"1BI23MCA002", name:"Priya Nair",   status:"absent"  },
      { usn:"1BI23MCA003", name:"Rohan Kumar",  status:"present" },
      { usn:"1BI23MCA004", name:"Sneha Patil",  status:"absent"  }
    ],
    notes: [
      "Introduction to Binary Trees and their properties",
      "Tree traversal methods: Inorder, Preorder, Postorder",
      "Practice problems on BST insertion and deletion"
    ],
    exams: [
      { title: "Binary Trees Quiz", avgScore: 76 }
    ]
  },
  {
    id: 2,
    roomCode: "CS4B01",
    subject: "Database Management",
    teacher: "Prof. Arjun Nair",
    teacherId: 2,
    semester: 4,
    date: "2026-10-08",
    duration: 50,
    studentsPresent: 35,
    totalStudents: 38,
    status: "completed",
    notesCount: 2,
    examsConducted: 0,
    attendance: [
      { usn:"1BI22MCA001", name:"Arjun Singh",  status:"present" },
      { usn:"1BI22MCA002", name:"Divya Rao",    status:"present" },
      { usn:"1BI22MCA003", name:"Karan Verma",  status:"absent"  }
    ],
    notes: [
      "Advanced SQL Joins — INNER, LEFT, RIGHT, FULL OUTER",
      "Normalization — 1NF, 2NF, 3NF with examples"
    ],
    exams: []
  },
  {
    id: 3,
    roomCode: "CS5C01",
    subject: "Web Development",
    teacher: "Prof. Sneha Verma",
    teacherId: 3,
    semester: 5,
    date: "2026-10-07",
    duration: 60,
    studentsPresent: 28,
    totalStudents: 30,
    status: "completed",
    notesCount: 4,
    examsConducted: 1,
    attendance: [
      { usn:"1BI21MCA001", name:"Ananya Iyer",  status:"present" },
      { usn:"1BI21MCA002", name:"Vikram Bose",  status:"present" }
    ],
    notes: [
      "React Hooks — useState and useEffect deep dive",
      "Custom Hooks — creating reusable logic",
      "Context API for state management",
      "Performance optimization with useMemo and useCallback"
    ],
    exams: [
      { title: "React Hooks Quiz", avgScore: 82 }
    ]
  },
  {
    id: 4,
    roomCode: "CS3A02",
    subject: "Data Structures",
    teacher: "Prof. Priya Sharma",
    teacherId: 1,
    semester: 3,
    date: "2026-10-06",
    duration: 50,
    studentsPresent: 40,
    totalStudents: 42,
    status: "completed",
    notesCount: 2,
    examsConducted: 0,
    attendance: [],
    notes: [
      "Graph representation — Adjacency Matrix vs List",
      "BFS and DFS traversal algorithms"
    ],
    exams: []
  },
  {
    id: 5,
    roomCode: "CS5C02",
    subject: "Web Development",
    teacher: "Prof. Sneha Verma",
    teacherId: 3,
    semester: 5,
    date: "2026-10-05",
    duration: 55,
    studentsPresent: 29,
    totalStudents: 30,
    status: "completed",
    notesCount: 3,
    examsConducted: 0,
    attendance: [],
    notes: [
      "Tailwind CSS utility classes",
      "Responsive design with Tailwind breakpoints",
      "Building reusable component library"
    ],
    exams: []
  },
  {
    id: 6,
    roomCode: "CS4B02",
    subject: "Database Management",
    teacher: "Prof. Arjun Nair",
    teacherId: 2,
    semester: 4,
    date: "2026-10-04",
    duration: 45,
    studentsPresent: 33,
    totalStudents: 38,
    status: "completed",
    notesCount: 1,
    examsConducted: 1,
    attendance: [],
    notes: [
      "Transaction management and ACID properties"
    ],
    exams: [
      { title: "ACID Properties Quiz", avgScore: 74 }
    ]
  }
]

export const ALERTS_SENT = [
  {
    id: 1,
    to: "Prof. Priya Sharma",
    teacherId: 1,
    message: "Please ensure all students complete the " +
      "assignment before the next session.",
    sentAt: "2026-10-08 10:30 AM",
    type: "reminder"
  },
  {
    id: 2,
    to: "Prof. Arjun Nair",
    teacherId: 2,
    message: "Kindly submit the mid-semester exam results " +
      "by this Friday.",
    sentAt: "2026-10-06 02:15 PM",
    type: "reminder"
  }
]

export const MONTHLY_STATS = [
  { month: "May", attendance: 88, sessions: 45, avgScore: 74 },
  { month: "Jun", attendance: 85, sessions: 52, avgScore: 76 },
  { month: "Jul", attendance: 90, sessions: 48, avgScore: 78 },
  { month: "Aug", attendance: 87, sessions: 55, avgScore: 75 },
  { month: "Sep", attendance: 83, sessions: 50, avgScore: 79 },
  { month: "Oct", attendance: 86, sessions: 28, avgScore: 77 }
]

// Returns all students below 75% attendance
export const getAtRiskStudents = () =>
  STUDENTS.filter(s => s.attendance.overall < 75)

// Returns all pending teachers
export const getPendingTeachers = () =>
  TEACHERS.filter(t => t.status === 'pending')

// Returns all approved teachers
export const getApprovedTeachers = () =>
  TEACHERS.filter(t => t.status === 'approved')

// Returns average exam score across all students
export const getDeptAvgScore = () => {
  const allScores = STUDENTS.flatMap(s =>
    s.exams.map(e => (e.score / e.total) * 100)
  )
  if (!allScores.length) return 0
  return Math.round(
    allScores.reduce((a, b) => a + b, 0) / allScores.length
  )
}

// Returns overall department attendance %
export const getDeptAvgAttendance = () => {
  const all = STUDENTS.map(s => s.attendance.overall)
  return Math.round(
    all.reduce((a, b) => a + b, 0) / all.length
  )
}

// Returns top N students sorted by avg exam score
export const getTopStudents = (n = 10) => {
  return STUDENTS
    .map(s => {
      const scores = s.exams.map(e =>
        Math.round((e.score / e.total) * 100)
      )
      const avg = scores.length
        ? Math.round(
            scores.reduce((a, b) => a + b, 0) / scores.length
          )
        : 0
      return { ...s, avgScore: avg }
    })
    .sort((a, b) => b.avgScore - a.avgScore)
    .slice(0, n)
}

// Returns semester-wise attendance summary
export const getSemesterAttendance = () => [
  {
    semester: "Sem 3",
    pct: Math.round(
      STUDENTS.filter(s => s.semester === 3)
        .reduce((a, s) => a + s.attendance.overall, 0) /
      STUDENTS.filter(s => s.semester === 3).length
    )
  },
  {
    semester: "Sem 4",
    pct: Math.round(
      STUDENTS.filter(s => s.semester === 4)
        .reduce((a, s) => a + s.attendance.overall, 0) /
      STUDENTS.filter(s => s.semester === 4).length
    )
  },
  {
    semester: "Sem 5",
    pct: Math.round(
      STUDENTS.filter(s => s.semester === 5)
        .reduce((a, s) => a + s.attendance.overall, 0) /
      STUDENTS.filter(s => s.semester === 5).length
    )
  }
]
