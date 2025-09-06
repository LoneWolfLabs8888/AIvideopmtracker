import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Users, Clock, CheckCircle, Circle, Edit3, Trash2, Settings, UserPlus, X } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';


const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const App = () => {
  const [projects, setProjects] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [workflowSteps, setWorkflowSteps] = useState([]);
  const [showNewProject, setShowNewProject] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load data from database on startup
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadProjects(),
        loadTeamMembers(),
        loadWorkflowSteps()
      ]);
    } catch (err) {
      setError('Failed to load data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadProjects = async () => {
    const { data, error } = await supabase
      .from('projects')
      .select(`
        *,
        project_steps (*)
      `)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    setProjects(data || []);
  };

  const loadTeamMembers = async () => {
    const { data, error } = await supabase
      .from('team_members')
      .select('*')
      .order('name');
    
    if (error) throw error;
    setTeamMembers(data || []);
  };

  const loadWorkflowSteps = async () => {
    const { data, error } = await supabase
      .from('workflow_templates')
      .select('*')
      .order('step_order');
    
    if (error) throw error;
    setWorkflowSteps(data || []);
  };

  const createNewProject = async (projectData) => {
    try {
      // Create project
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert([{
          name: projectData.name,
          client: projectData.client,
          start_date: projectData.startDate,
          end_date: projectData.endDate,
          priority: projectData.priority,
          description: projectData.description
        }])
        .select()
        .single();

      if (projectError) throw projectError;

      // Create project steps from workflow template
      const projectSteps = workflowSteps.map(step => ({
        project_id: project.id,
        name: step.name,
        step_order: step.step_order,
        status: 'pending',
        estimated_days: step.estimated_days
      }));

      const { error: stepsError } = await supabase
        .from('project_steps')
        .insert(projectSteps);

      if (stepsError) throw stepsError;

      setShowNewProject(false);
      await loadProjects();
    } catch (err) {
      setError('Failed to create project: ' + err.message);
    }
  };

  const updateProjectStep = async (projectId, stepId, updates) => {
    try {
      const { error } = await supabase
        .from('project_steps')
        .update(updates)
        .eq('id', stepId);

      if (error) throw error;
      await loadProjects();
    } catch (err) {
      setError('Failed to update step: ' + err.message);
    }
  };

  const deleteProject = async (projectId) => {
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);

      if (error) throw error;
      await loadProjects();
    } catch (err) {
      setError('Failed to delete project: ' + err.message);
    }
  };

  const addTeamMember = async (name) => {
    try {
      const { error } = await supabase
        .from('team_members')
        .insert([{ name: name.trim() }]);

      if (error) throw error;
      await loadTeamMembers();
    } catch (err) {
      setError('Failed to add team member: ' + err.message);
    }
  };

  const removeTeamMember = async (id) => {
    try {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadTeamMembers();
    } catch (err) {
      setError('Failed to remove team member: ' + err.message);
    }
  };

  const addWorkflowStep = async (name, estimatedDays) => {
    try {
      const maxOrder = Math.max(...workflowSteps.map(s => s.step_order), 0);
      const { error } = await supabase
        .from('workflow_templates')
        .insert([{
          name: name.trim(),
          step_order: maxOrder + 1,
          estimated_days: estimatedDays
        }]);

      if (error) throw error;
      await loadWorkflowSteps();
    } catch (err) {
      setError('Failed to add workflow step: ' + err.message);
    }
  };

  const removeWorkflowStep = async (id) => {
    try {
      const { error } = await supabase
        .from('workflow_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadWorkflowSteps();
    } catch (err) {
      setError('Failed to remove workflow step: ' + err.message);
    }
  };

  const updateWorkflowStep = async (id, updates) => {
    try {
      const { error } = await supabase
        .from('workflow_templates')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      await loadWorkflowSteps();
    } catch (err) {
      setError('Failed to update workflow step: ' + err.message);
    }
  };

  const getProjectProgress = (project) => {
    if (!project.project_steps) return 0;
    const completedSteps = project.project_steps.filter(step => step.status === 'completed').length;
    return Math.round((completedSteps / project.project_steps.length) * 100);
  };

  const getProjectStatus = (project) => {
    const progress = getProjectProgress(project);
    if (progress === 100) return 'completed';
    if (progress === 0) return 'not-started';
    return 'in-progress';
  };

  const filteredProjects = projects.filter(project => {
    const matchesSearch = project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         project.client.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || getProjectStatus(project) === filterStatus;
    return matchesSearch && matchesFilter;
  });

  // Settings Component
  const SettingsModal = () => {
    const [activeTab, setActiveTab] = useState('team');
    const [newMemberName, setNewMemberName] = useState('');
    const [newStepName, setNewStepName] = useState('');
    const [newStepDays, setNewStepDays] = useState(1);
    const [editingStep, setEditingStep] = useState(null);

    const handleAddMember = async () => {
      if (newMemberName.trim()) {
        await addTeamMember(newMemberName);
        setNewMemberName('');
      }
    };

    const handleAddStep = async () => {
      if (newStepName.trim()) {
        await addWorkflowStep(newStepName, newStepDays);
        setNewStepName('');
        setNewStepDays(1);
      }
    };

    const handleUpdateStep = async (id, field, value) => {
      await updateWorkflowStep(id, { [field]: value });
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Settings</h2>
            <button onClick={() => setShowSettings(false)} className="text-gray-500 hover:text-gray-700">
              <X size={24} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex space-x-4 mb-6 border-b">
            <button
              className={`pb-2 px-1 ${activeTab === 'team' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
              onClick={() => setActiveTab('team')}
            >
              Team Members
            </button>
            <button
              className={`pb-2 px-1 ${activeTab === 'workflow' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
              onClick={() => setActiveTab('workflow')}
            >
              Workflow Steps
            </button>
          </div>

          {/* Team Members Tab */}
          {activeTab === 'team' && (
            <div>
              <div className="mb-4 flex space-x-2">
                <input
                  type="text"
                  placeholder="Enter team member name"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  className="flex-1 p-2 border rounded-md"
                  onKeyPress={(e) => e.key === 'Enter' && handleAddMember()}
                />
                <button
                  onClick={handleAddMember}
                  className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 flex items-center space-x-2"
                >
                  <UserPlus size={16} />
                  <span>Add</span>
                </button>
              </div>

              <div className="space-y-2">
                {teamMembers.map(member => (
                  <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                    <span className="font-medium">{member.name}</span>
                    <button
                      onClick={() => removeTeamMember(member.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Workflow Steps Tab */}
          {activeTab === 'workflow' && (
            <div>
              <div className="mb-4 flex space-x-2">
                <input
                  type="text"
                  placeholder="Enter step name"
                  value={newStepName}
                  onChange={(e) => setNewStepName(e.target.value)}
                  className="flex-1 p-2 border rounded-md"
                />
                <input
                  type="number"
                  placeholder="Days"
                  value={newStepDays}
                  onChange={(e) => setNewStepDays(parseInt(e.target.value) || 1)}
                  className="w-20 p-2 border rounded-md"
                  min="1"
                />
                <button
                  onClick={handleAddStep}
                  className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
                >
                  Add Step
                </button>
              </div>

              <div className="space-y-2">
                {workflowSteps.map((step, index) => (
                  <div key={step.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-md">
                    <span className="w-8 text-center font-medium text-gray-500">{index + 1}</span>
                    {editingStep === step.id ? (
                      <>
                        <input
                          type="text"
                          value={step.name}
                          onChange={(e) => handleUpdateStep(step.id, 'name', e.target.value)}
                          className="flex-1 p-1 border rounded"
                          onBlur={() => setEditingStep(null)}
                          onKeyPress={(e) => e.key === 'Enter' && setEditingStep(null)}
                          autoFocus
                        />
                        <input
                          type="number"
                          value={step.estimated_days}
                          onChange={(e) => handleUpdateStep(step.id, 'estimated_days', parseInt(e.target.value))}
                          className="w-16 p-1 border rounded text-center"
                          min="1"
                        />
                      </>
                    ) : (
                      <>
                        <span className="flex-1 cursor-pointer" onClick={() => setEditingStep(step.id)}>
                          {step.name}
                        </span>
                        <span className="w-16 text-center text-gray-600">{step.estimated_days}d</span>
                      </>
                    )}
                    <button
                      onClick={() => removeWorkflowStep(step.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // New Project Form Component
  const NewProjectForm = () => {
    const [formData, setFormData] = useState({
      name: '',
      client: '',
      startDate: '',
      endDate: '',
      priority: 'medium',
      description: ''
    });

    const handleSubmit = () => {
      if (formData.name && formData.client && formData.startDate && formData.endDate) {
        createNewProject(formData);
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md">
          <h2 className="text-xl font-bold mb-4">Create New Video Project</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Project Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full p-2 border rounded-md"
                placeholder="e.g., Product Demo Video"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Client Name</label>
              <input
                type="text"
                required
                value={formData.client}
                onChange={(e) => setFormData({...formData, client: e.target.value})}
                className="w-full p-2 border rounded-md"
                placeholder="Client company name"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Start Date</label>
                <input
                  type="date"
                  required
                  value={formData.startDate}
                  onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                  className="w-full p-2 border rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Target End Date</label>
                <input
                  type="date"
                  required
                  value={formData.endDate}
                  onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                  className="w-full p-2 border rounded-md"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Priority</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({...formData, priority: e.target.value})}
                className="w-full p-2 border rounded-md"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="w-full p-2 border rounded-md"
                rows="3"
                placeholder="Brief project description..."
              />
            </div>
            <div className="flex space-x-4 pt-4">
              <button
                type="button"
                onClick={handleSubmit}
                className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600"
              >
                Create Project
              </button>
              <button
                type="button"
                onClick={() => setShowNewProject(false)}
                className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Project Card Component
  const ProjectCard = ({ project }) => {
    const progress = getProjectProgress(project);
    const status = getProjectStatus(project);
    const statusColors = {
      'not-started': 'bg-gray-100 text-gray-800',
      'in-progress': 'bg-blue-100 text-blue-800',
      'completed': 'bg-green-100 text-green-800'
    };

    const priorityColors = {
      low: 'border-l-green-400',
      medium: 'border-l-yellow-400',
      high: 'border-l-red-400'
    };

    return (
      <div className={`bg-white rounded-lg shadow-md p-4 border-l-4 ${priorityColors[project.priority]} hover:shadow-lg transition-shadow`}>
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="font-semibold text-lg text-gray-800">{project.name}</h3>
            <p className="text-gray-600 text-sm">{project.client}</p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setSelectedProject(project)}
              className="text-blue-500 hover:text-blue-700"
            >
              <Edit3 size={16} />
            </button>
            <button
              onClick={() => deleteProject(project.id)}
              className="text-red-500 hover:text-red-700"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
        
        <div className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${statusColors[status]} mb-3`}>
          {status.replace('-', ' ').toUpperCase()}
        </div>
        
        <div className="mb-3">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
        
        <div className="text-sm text-gray-600 space-y-1">
          <div className="flex justify-between">
            <span>Start:</span>
            <span>{new Date(project.start_date).toLocaleDateString()}</span>
          </div>
          <div className="flex justify-between">
            <span>End:</span>
            <span>{new Date(project.end_date).toLocaleDateString()}</span>
          </div>
          <div className="flex justify-between">
            <span>Priority:</span>
            <span className="capitalize font-medium">{project.priority}</span>
          </div>
        </div>
      </div>
    );
  };

  // Project Detail Component
  const ProjectDetail = ({ project, onClose }) => {
    const handleStepUpdate = async (stepId, field, value) => {
      await updateProjectStep(project.id, stepId, { [field]: value });
      
      if (field === 'status' && value === 'completed') {
        const currentIndex = project.project_steps.findIndex(step => step.id === stepId);
        if (currentIndex < project.project_steps.length - 1) {
          const nextStep = project.project_steps[currentIndex + 1];
          if (nextStep.status === 'pending') {
            await updateProjectStep(project.id, nextStep.id, { status: 'in-progress' });
          }
        }
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold">{project.name}</h2>
              <p className="text-gray-600">Client: {project.client}</p>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <X size={24} />
            </button>
          </div>
          
          <div className="space-y-4">
            {project.project_steps?.map((step) => (
              <div key={step.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => handleStepUpdate(step.id, 'status', 
                        step.status === 'completed' ? 'pending' : 'completed'
                      )}
                      className={`${step.status === 'completed' ? 'text-green-500' : 'text-gray-400'}`}
                    >
                      {step.status === 'completed' ? <CheckCircle size={20} /> : <Circle size={20} />}
                    </button>
                    <span className={`font-medium ${step.status === 'completed' ? 'line-through text-gray-500' : ''}`}>
                      {step.name}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <select
                      value={step.status}
                      onChange={(e) => handleStepUpdate(step.id, 'status', e.target.value)}
                      className="text-xs border rounded px-2 py-1"
                    >
                      <option value="pending">Pending</option>
                      <option value="in-progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="blocked">Blocked</option>
                    </select>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <label className="block text-gray-600 text-xs">Assignee</label>
                    <select
                      value={step.assignee || ''}
                      onChange={(e) => handleStepUpdate(step.id, 'assignee', e.target.value)}
                      className="w-full border rounded px-2 py-1"
                    >
                      <option value="">Unassigned</option>
                      {teamMembers.map(member => (
                        <option key={member.id} value={member.name}>{member.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-600 text-xs">Due Date</label>
                    <input
                      type="date"
                      value={step.due_date || ''}
                      onChange={(e) => handleStepUpdate(step.id, 'due_date', e.target.value)}
                      className="w-full border rounded px-2 py-1"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 text-xs">Est. Days</label>
                    <input
                      type="number"
                      value={step.estimated_days || 1}
                      onChange={(e) => handleStepUpdate(step.id, 'estimated_days', parseInt(e.target.value))}
                      className="w-full border rounded px-2 py-1"
                      min="1"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your projects...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-lg shadow-md">
          <p className="text-red-600 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">AI Video Production Tracker</h1>
              <p className="text-gray-600">Manage your video projects from script to delivery</p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowSettings(true)}
                className="bg-gray-500 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-gray-600"
              >
                <Settings size={20} />
                <span>Settings</span>
              </button>
              <button
                onClick={() => setShowNewProject(true)}
                className="bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-600"
              >
                <Plus size={20} />
                <span>New Project</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex justify-between items-center mb-6">
          <div className="flex space-x-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Search projects..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-4 pr-4 py-2 border rounded-lg w-64"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="border rounded-lg px-3 py-2"
            >
              <option value="all">All Projects</option>
              <option value="not-started">Not Started</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        {/* Projects Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map(project => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>

        {filteredProjects.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <Calendar size={64} className="mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-600 mb-2">No projects found</h3>
            <p className="text-gray-500">Create your first AI video project to get started</p>
          </div>
        )}
      </div>

      {/* Modals */}
      {showNewProject && <NewProjectForm />}
      {selectedProject && (
        <ProjectDetail 
          project={selectedProject} 
          onClose={() => setSelectedProject(null)} 
        />
      )}
      {showSettings && <SettingsModal />}
    </div>
  );
};

export default App;