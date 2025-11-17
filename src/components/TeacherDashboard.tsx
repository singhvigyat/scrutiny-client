import React, { useState } from 'react';
import { 
  Plus, 
  BookOpen, 
  FileText, 
  Users, 
  AlertTriangle, 
  Video, 
  CheckCircle, 
  Play, 
  Edit, 
  Eye 
} from 'lucide-react';

interface Quiz {
  id: string;
  title: string;
  duration: number;
  totalQuestions: number;
  createdAt: string;
  status: 'draft' | 'active' | 'completed';
  studentsAssigned: number;
  submissions: number;
}

interface OngoingTest {
  id: string;
  quizTitle: string;
  studentName: string;
  startTime: string;
  progress: number;
  warnings: number;
}

interface RecentActivity {
  id: string;
  type: 'submission' | 'warning' | 'quiz_created' | 'student_started';
  message: string;
  timestamp: string;
}

export const TeacherDashboard = () => {
  // Mock data - replace with real API calls
  const [quizzes] = useState<Quiz[]>([
    {
      id: '1',
      title: 'Mathematics Mid-Term Exam',
      duration: 60,
      totalQuestions: 50,
      createdAt: '2025-11-15',
      status: 'active',
      studentsAssigned: 35,
      submissions: 28,
    },
    {
      id: '2',
      title: 'Physics Quiz - Chapter 5',
      duration: 30,
      totalQuestions: 25,
      createdAt: '2025-11-14',
      status: 'completed',
      studentsAssigned: 32,
      submissions: 32,
    },
    {
      id: '3',
      title: 'Chemistry Lab Assessment',
      duration: 45,
      totalQuestions: 30,
      createdAt: '2025-11-17',
      status: 'draft',
      studentsAssigned: 0,
      submissions: 0,
    },
  ]);

  const [ongoingTests] = useState<OngoingTest[]>([
    {
      id: '1',
      quizTitle: 'Mathematics Mid-Term Exam',
      studentName: 'John Doe',
      startTime: '10:30 AM',
      progress: 65,
      warnings: 0,
    },
    {
      id: '2',
      quizTitle: 'Mathematics Mid-Term Exam',
      studentName: 'Jane Smith',
      startTime: '10:32 AM',
      progress: 58,
      warnings: 2,
    },
    {
      id: '3',
      quizTitle: 'Mathematics Mid-Term Exam',
      studentName: 'Mike Johnson',
      startTime: '10:35 AM',
      progress: 42,
      warnings: 1,
    },
  ]);

  const [recentActivities] = useState<RecentActivity[]>([
    {
      id: '1',
      type: 'warning',
      message: 'Jane Smith received warning #2 - Window switching attempt',
      timestamp: '5 mins ago',
    },
    {
      id: '2',
      type: 'submission',
      message: 'Sarah Williams submitted Mathematics Mid-Term Exam',
      timestamp: '12 mins ago',
    },
    {
      id: '3',
      type: 'student_started',
      message: 'Mike Johnson started Mathematics Mid-Term Exam',
      timestamp: '18 mins ago',
    },
    {
      id: '4',
      type: 'warning',
      message: 'Mike Johnson received warning #1 - Tab switching attempt',
      timestamp: '22 mins ago',
    },
  ]);

  const totalQuizzes = quizzes.length;
  const activeQuizzes = quizzes.filter((q) => q.status === 'active').length;
  const totalStudentsActive = ongoingTests.length;
  const totalWarnings = ongoingTests.reduce((sum, test) => sum + test.warnings, 0);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'completed':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'draft':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case 'submission':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'quiz_created':
        return <FileText className="w-4 h-4 text-blue-600" />;
      case 'student_started':
        return <Play className="w-4 h-4 text-purple-600" />;
      default:
        return <div className="w-1 h-1 bg-gray-400 rounded-full" />;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 px-8 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
        
            <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: '"Playfair Display", serif', fontOpticalSizing: 'auto' }}>Scrutiny</h1>
          </div>    
          <div className="flex items-center gap-4">
            <button className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium transition-colors">
              Dashboard
            </button>
            <button className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium transition-colors">
              My Quizzes
            </button>
            <button className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium transition-colors">
              Students
            </button>
            <button className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium transition-colors">
              Reports
            </button>
            <div className="w-px h-6 bg-gray-300"></div>
            <button className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium transition-colors">
              Recordings
            </button>
            <div className="w-px h-6 bg-gray-300"></div>
            <button className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors">
              <span className="text-sm font-semibold text-gray-700">T</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-auto px-8 py-6">
        {/* Top Row - Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Create Quiz Card */}
          <button className="bg-white p-4 rounded-lg border-2 border-gray-200 hover:border-blue-400 transition-all group text-center h-40 flex flex-col items-center justify-center">
            <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center mb-3 group-hover:bg-blue-100 transition-colors">
              <Plus className="w-6 h-6 text-blue-600" strokeWidth={2.5} />
            </div>
            <h3 className="text-base font-bold text-gray-900">Create Quiz</h3>
            <p className="text-xs text-gray-600 mt-1">Start a new assessment</p>
          </button>

          {/* Recent Quiz Card */}
          <div className="bg-white p-4 rounded-lg border border-gray-200 h-40 flex flex-col">
            <div className="flex items-start justify-between mb-2">
              <h3 className="text-sm font-bold text-gray-900 line-clamp-2">Midterm Quiz 01 </h3>
              <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded border border-green-200 whitespace-nowrap ml-2">
                Active
              </span>
            </div>
            <p className="text-xs text-gray-600 mb-auto">35 students • 28 submitted</p>
            <div className="flex gap-2 mt-3">
              <button className="flex-1 px-2 py-1.5 text-xs bg-blue-50 text-blue-700 font-medium rounded hover:bg-blue-100 transition-colors">
                View
              </button>
              <button className="flex-1 px-2 py-1.5 text-xs bg-red-50 text-red-700 font-medium rounded hover:bg-red-100 transition-colors">
                End
              </button>
            </div>
          </div>

          {/* See All Quizzes Card */}
          <button className="bg-white p-4 rounded-lg border-2 border-gray-200 hover:border-blue-400 transition-all group text-center h-40 flex flex-col items-center justify-center">
            <div className="w-12 h-12 bg-gray-50 rounded-lg flex items-center justify-center mb-3 group-hover:bg-gray-100 transition-colors">
              <BookOpen className="w-6 h-6 text-gray-700" strokeWidth={2} />
            </div>
            <h3 className="text-base font-bold text-gray-900">See All Quizzes</h3>
            <p className="text-xs text-gray-600 mt-1">View & manage all</p>
          </button>
        </div>

        {/* Second Row - Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {/* Total Quizzes */}
          <div className="bg-white p-4 rounded-lg border border-gray-200 h-32 flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1">Total Quizzes</p>
                <p className="text-2xl font-bold text-gray-900">{totalQuizzes}</p>
                <p className="text-xs text-gray-500 mt-1">{activeQuizzes} active now</p>
              </div>
              <div className="w-11 h-11 bg-blue-100 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-blue-600" strokeWidth={2} />
              </div>
            </div>
          </div>

          {/* Students Testing */}
          <div className="bg-white p-4 rounded-lg border border-gray-200 h-32 flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1">Students Testing</p>
                <p className="text-2xl font-bold text-purple-600">{totalStudentsActive}</p>
                <p className="text-xs text-gray-500 mt-1">Active sessions</p>
              </div>
              <div className="w-11 h-11 bg-purple-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-purple-600" strokeWidth={2} />
              </div>
            </div>
          </div>

          {/* Active Warnings */}
          <div className="bg-white p-4 rounded-lg border border-gray-200 h-32 flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1">Active Warnings</p>
                <p className="text-2xl font-bold text-red-600">{totalWarnings}</p>
                <p className="text-xs text-gray-500 mt-1">Requires attention</p>
              </div>
              <div className="w-11 h-11 bg-red-100 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" strokeWidth={2} />
              </div>
            </div>
          </div>

          {/* Video Recordings */}
          <button className="bg-white p-4 rounded-lg border-2 border-gray-200 hover:border-blue-400 h-32 flex flex-col justify-between transition-all group">
            <div className="flex items-start justify-between">
              <div className="text-left">
                <p className="text-xs font-medium text-gray-600 mb-1">Video Recordings</p>
                <p className="text-2xl font-bold text-gray-900">12</p>
                <p className="text-xs text-gray-500 mt-1">3 live streams</p>
              </div>
              <div className="w-11 h-11 bg-orange-100 rounded-lg flex items-center justify-center group-hover:bg-orange-200 transition-colors">
                <Video className="w-5 h-5 text-orange-600" strokeWidth={2} />
              </div>
            </div>
          </button>
        </div>

        {/* Bottom Row - Large Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Ongoing Tests - Takes 2 columns */}
          <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">Ongoing Tests</h2>
              <p className="text-sm text-gray-600 mt-1">Real-time monitoring of active exams</p>
            </div>
            <div className="p-6 max-h-[500px] overflow-auto">
              {ongoingTests.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-8 h-8 text-gray-400" strokeWidth={2} />
                  </div>
                  <p className="text-gray-500 font-medium">No ongoing tests</p>
                  <p className="text-sm text-gray-400 mt-1">Tests will appear here when students start</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {ongoingTests.map((test) => (
                    <div
                      key={test.id}
                      className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{test.studentName}</h3>
                          <p className="text-sm text-gray-600 mt-0.5">{test.quizTitle}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {test.warnings > 0 && (
                            <span className="px-2.5 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-full border border-red-200 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" strokeWidth={2.5} />
                              {test.warnings}
                            </span>
                          )}
                          <span className="text-xs text-gray-500 font-medium">{test.startTime}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Progress</span>
                          <span className="font-semibold text-gray-900">{test.progress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                          <div
                            className={`h-2.5 rounded-full transition-all ${
                              test.warnings > 0 ? 'bg-red-500' : 'bg-blue-600'
                            }`}
                            style={{ width: `${test.progress}%` }}
                          ></div>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button className="px-3 py-1.5 text-xs bg-blue-50 text-blue-700 font-medium rounded hover:bg-blue-100 transition-colors">
                          Monitor
                        </button>
                        <button className="px-3 py-1.5 text-xs bg-orange-50 text-orange-700 font-medium rounded hover:bg-orange-100 transition-colors flex items-center gap-1">
                          <Video className="w-3.5 h-3.5" strokeWidth={2} />
                          Live
                        </button>
                        {test.warnings > 0 && (
                          <button className="px-3 py-1.5 text-xs bg-red-50 text-red-700 font-medium rounded hover:bg-red-100 transition-colors">
                            Warnings
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Test Activities - Takes 1 column */}
          <div className="lg:col-span-1 bg-white rounded-lg border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">Test Activities</h2>
              <p className="text-sm text-gray-600 mt-1">Latest updates</p>
            </div>
            <div className="p-6 max-h-[500px] overflow-auto">
              <div className="space-y-4">
                {recentActivities.map((activity) => (
                  <div key={activity.id} className="flex gap-3">
                    <div className="shrink-0 w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center">
                      {getActivityIcon(activity.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 leading-snug">{activity.message}</p>
                      <p className="text-xs text-gray-500 mt-1">{activity.timestamp}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};