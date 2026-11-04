import React, { useEffect, useRef, useState } from 'react';

const emptyAccountForm = { firstName: '', lastName: '', username: '', password: '' };
const emptyProjectForm = { name: '', description: '', status: 'Planning', projectLeadId: '' };
const emptyStoryForm = { title: '', description: '', priority: 'Medium', status: 'To Do', assigned_user_id: '' };
const PRIORITIES = ['High', 'Medium', 'Low'];
const STATUSES = ['To Do', 'In Progress', 'Done'];

function statusClass(status) {
  return status.toLowerCase().replace(/\s+/g, '-');
}

async function readResponse(response) {
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Something went wrong.');
  return data;
}

function App() {
  const [section, setSection] = useState('account');
  const [accountMode, setAccountMode] = useState('signup');
  const [accountForm, setAccountForm] = useState(emptyAccountForm);
  const [projectForm, setProjectForm] = useState(emptyProjectForm);
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [members, setMembers] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);
  const [stories, setStories] = useState([]);
  const [storiesLoaded, setStoriesLoaded] = useState(false);
  const [storyForm, setStoryForm] = useState(emptyStoryForm);
  const [editingStoryId, setEditingStoryId] = useState(null);
  const [openStoryId, setOpenStoryId] = useState(null);
  // Tracks the project currently on screen so late responses for an old project are ignored.
  const currentProjectRef = useRef('');

  useEffect(() => {
    loadUsers();
    loadProjects();
  }, []);

  useEffect(() => {
    currentProjectRef.current = selectedProjectId;
    // Switching projects clears the old backlog, open details, and any edit form.
    setStories([]);
    setStoriesLoaded(false);
    setEditingStoryId(null);
    setOpenStoryId(null);
    setStoryForm(emptyStoryForm);

    if (selectedProjectId) {
      loadMembers(selectedProjectId);
      loadStories(selectedProjectId);
    } else {
      setMembers([]);
    }
  }, [selectedProjectId]);

  async function loadUsers() {
    try {
      const response = await fetch('/api/users');
      const data = await readResponse(response);
      setUsers(data);
    } catch (error) {
      // The account page can still load before the server is started.
    }
  }

  async function loadProjects() {
    try {
      const response = await fetch('/api/projects');
      const data = await readResponse(response);
      setProjects(data);
      if (data.length && !selectedProjectId) setSelectedProjectId(data[0]._id);
    } catch (error) {
      // A visible message is shown when the user performs an operation.
    }
  }

  async function loadMembers(projectId) {
    try {
      const response = await fetch(`/api/projects/${projectId}/members`);
      setMembers(await readResponse(response));
    } catch (error) {
      setMembers([]);
      setFeedback({ type: 'error', message: error.message });
    }
  }

  async function loadStories(projectId) {
    try {
      const response = await fetch(`/api/projects/${projectId}/stories`);
      const data = await readResponse(response);
      if (currentProjectRef.current !== projectId) return;
      setStories(data);
      setStoriesLoaded(true);
    } catch (error) {
      if (currentProjectRef.current !== projectId) return;
      setStories([]);
      setStoriesLoaded(true);
      setFeedback({ type: 'error', message: error.message });
    }
  }

  function updateStoryField(event) {
    setStoryForm({ ...storyForm, [event.target.name]: event.target.value });
    setFeedback(null);
  }

  function startEditingStory(story) {
    setEditingStoryId(story._id);
    setOpenStoryId(null);
    setStoryForm({
      title: story.title,
      description: story.description,
      priority: story.priority,
      status: story.status,
      assigned_user_id: story.assigned_user_id || ''
    });
    setFeedback(null);
  }

  function cancelStoryEdit() {
    setEditingStoryId(null);
    setStoryForm(emptyStoryForm);
    setFeedback(null);
  }

  async function handleStorySubmit(event) {
    event.preventDefault();
    if (!selectedProjectId) {
      setFeedback({ type: 'error', message: 'Select a project first.' });
      return;
    }
    if (!storyForm.title.trim() || !storyForm.description.trim() || !storyForm.priority) {
      setFeedback({ type: 'error', message: 'Title, description, and priority are required.' });
      return;
    }

    const projectId = selectedProjectId;
    const isEditing = Boolean(editingStoryId);
    const body = {
      title: storyForm.title,
      description: storyForm.description,
      priority: storyForm.priority,
      assigned_user_id: storyForm.assigned_user_id || null
    };
    if (isEditing) body.status = storyForm.status;

    setLoading(true);
    try {
      const response = await fetch(
        isEditing ? `/api/projects/${projectId}/stories/${editingStoryId}` : `/api/projects/${projectId}/stories`,
        {
          method: isEditing ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        }
      );
      const result = await readResponse(response);
      setFeedback({ type: 'success', message: result.message });
      setEditingStoryId(null);
      setStoryForm(emptyStoryForm);
      await loadStories(projectId);
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  }

  async function deleteStory(story) {
    if (!window.confirm(`Delete the story "${story.title}"? This cannot be undone.`)) {
      setFeedback({ type: 'success', message: 'Delete canceled. The story was not changed.' });
      return;
    }

    const projectId = selectedProjectId;
    setLoading(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/stories/${story._id}`, { method: 'DELETE' });
      const result = await readResponse(response);
      setFeedback({ type: 'success', message: result.message });
      if (editingStoryId === story._id) cancelStoryEdit();
      if (openStoryId === story._id) setOpenStoryId(null);
      await loadStories(projectId);
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  }

  function switchSection(nextSection) {
    setSection(nextSection);
    setFeedback(null);
    if (nextSection !== 'account') {
      loadUsers();
      loadProjects();
    }
  }

  function updateAccountField(event) {
    setAccountForm({ ...accountForm, [event.target.name]: event.target.value });
    setFeedback(null);
  }

  function updateProjectField(event) {
    setProjectForm({ ...projectForm, [event.target.name]: event.target.value });
    setFeedback(null);
  }

  async function handleAccountSubmit(event) {
    event.preventDefault();
    const required = accountMode === 'signup'
      ? ['firstName', 'lastName', 'username', 'password']
      : ['username', 'password'];

    if (required.some(field => !accountForm[field].trim())) {
      setFeedback({ type: 'error', message: `Please fill in every ${accountMode} field.` });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/${accountMode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(accountMode === 'signup' ? accountForm : {
          username: accountForm.username,
          password: accountForm.password
        })
      });
      const result = await readResponse(response);
      setFeedback({ type: 'success', message: result.message });
      setAccountForm(emptyAccountForm);
      await loadUsers();
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  }

  async function handleProjectSubmit(event) {
    event.preventDefault();
    if (!projectForm.name.trim() || !projectForm.description.trim() || !projectForm.status || !projectForm.projectLeadId) {
      setFeedback({ type: 'error', message: 'Please fill in every project field.' });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectForm)
      });
      const result = await readResponse(response);
      setFeedback({ type: 'success', message: result.message });
      setProjectForm(emptyProjectForm);
      await loadProjects();
      setSelectedProjectId(result.projectId);
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  }

  async function addMember(event) {
    event.preventDefault();
    if (!selectedProjectId || !selectedUserId) {
      setFeedback({ type: 'error', message: 'Select a project and a registered user first.' });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/projects/${selectedProjectId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUserId })
      });
      const result = await readResponse(response);
      setFeedback({ type: 'success', message: result.message });
      setSelectedUserId('');
      await loadMembers(selectedProjectId);
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  }

  async function removeMember(userId) {
    setLoading(true);
    try {
      const response = await fetch(`/api/projects/${selectedProjectId}/members/${userId}`, {
        method: 'DELETE'
      });
      const result = await readResponse(response);
      setFeedback({ type: 'success', message: result.message });
      await loadMembers(selectedProjectId);
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  }

  const isSignup = accountMode === 'signup';
  const selectedProject = projects.find(project => project._id === selectedProjectId);

  return (
    <main className="page">
      <section className="app-shell">
        <header className="header">
          <div>
            <div className="eyebrow">ICSI 418Y · Programming Assignment 3</div>
            <h1>Project Manager</h1>
            <p className="intro">Users, projects, project leads, and memberships stored in MongoDB.</p>
          </div>
        </header>

        <nav className="nav" aria-label="Application sections">
          <button className={section === 'account' ? 'active' : ''} onClick={() => switchSection('account')}>Signup / Login</button>
          <button className={section === 'create' ? 'active' : ''} onClick={() => switchSection('create')}>Create Project</button>
          <button className={section === 'projects' ? 'active' : ''} onClick={() => switchSection('projects')}>View Projects</button>
          <button className={section === 'members' ? 'active' : ''} onClick={() => switchSection('members')}>Memberships</button>
          <button className={section === 'backlog' ? 'active' : ''} onClick={() => switchSection('backlog')}>Backlog</button>
        </nav>

        {feedback && <p className={`feedback ${feedback.type}`} role="status">{feedback.message}</p>}

        {section === 'account' && (
          <section className="panel narrow">
            <div className="switcher" role="group" aria-label="Choose an account form">
              <button type="button" className={isSignup ? 'active' : ''} onClick={() => { setAccountMode('signup'); setFeedback(null); }}>Sign up</button>
              <button type="button" className={!isSignup ? 'active' : ''} onClick={() => { setAccountMode('login'); setFeedback(null); }}>Log in</button>
            </div>

            <form onSubmit={handleAccountSubmit} noValidate>
              {isSignup && (
                <div className="name-row">
                  <label>First name
                    <input name="firstName" value={accountForm.firstName} onChange={updateAccountField} />
                  </label>
                  <label>Last name
                    <input name="lastName" value={accountForm.lastName} onChange={updateAccountField} />
                  </label>
                </div>
              )}
              <label>Username
                <input name="username" value={accountForm.username} onChange={updateAccountField} />
              </label>
              <label>Password
                <input name="password" type="password" value={accountForm.password} onChange={updateAccountField} />
              </label>
              <button className="submit" type="submit" disabled={loading}>{loading ? 'Please wait…' : isSignup ? 'Create account' : 'Log in'}</button>
            </form>
          </section>
        )}

        {section === 'create' && (
          <section className="panel">
            <h2>Create Project</h2>
            <form onSubmit={handleProjectSubmit} noValidate>
              <label>Project name
                <input name="name" value={projectForm.name} onChange={updateProjectField} placeholder="Example: Campus Planner" />
              </label>
              <label>Description
                <textarea name="description" value={projectForm.description} onChange={updateProjectField} placeholder="Describe the software project." />
              </label>
              <div className="two-column">
                <label>Status
                  <select name="status" value={projectForm.status} onChange={updateProjectField}>
                    <option>Planning</option>
                    <option>Active</option>
                    <option>Completed</option>
                  </select>
                </label>
                <label>Project Lead
                  <select name="projectLeadId" value={projectForm.projectLeadId} onChange={updateProjectField}>
                    <option value="">Select a registered user</option>
                    {users.map(user => <option key={user._id} value={user._id}>{user.displayName} ({user.username})</option>)}
                  </select>
                </label>
              </div>
              {!users.length && <p className="hint">Create at least one user on the Signup / Login tab before creating a project.</p>}
              <button className="submit" type="submit" disabled={loading}>Create project</button>
            </form>
          </section>
        )}

        {section === 'projects' && (
          <section className="panel">
            <div className="section-heading">
              <div><h2>Projects</h2><p className="muted">Project Leads are displayed by name and username.</p></div>
              <button className="secondary" onClick={loadProjects}>Refresh</button>
            </div>
            {!projects.length ? <p className="empty">No projects have been created yet.</p> : (
              <div className="project-grid">
                {projects.map(project => (
                  <article className="project-card" key={project._id}>
                    <div className="project-top"><h3>{project.name}</h3><span className={`status ${project.status.toLowerCase()}`}>{project.status}</span></div>
                    <p>{project.description}</p>
                    <p className="lead"><strong>Project Lead:</strong> {project.projectLead ? `${project.projectLead.displayName} (${project.projectLead.username})` : 'User not found'}</p>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {section === 'members' && (
          <section className="panel">
            <h2>Manage Project Memberships</h2>
            <label>Select project
              <select value={selectedProjectId} onChange={event => { setSelectedProjectId(event.target.value); setFeedback(null); }}>
                <option value="">Select a project</option>
                {projects.map(project => <option key={project._id} value={project._id}>{project.name}</option>)}
              </select>
            </label>

            {selectedProject && (
              <>
                <div className="membership-box">
                  <h3>Current members of {selectedProject.name}</h3>
                  {!members.length ? <p className="empty">No members found.</p> : (
                    <div className="member-list">
                      {members.map(member => (
                        <div className="member-row" key={member._id}>
                          <div><strong>{member.displayName}</strong><span>@{member.username}</span>{member.isLead && <span className="lead-badge">Project Lead</span>}</div>
                          <button className="danger" disabled={member.isLead || loading} onClick={() => removeMember(member._id)}>{member.isLead ? 'Lead cannot be removed' : 'Remove'}</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <form className="add-member" onSubmit={addMember}>
                  <label>Add registered user
                    <select value={selectedUserId} onChange={event => setSelectedUserId(event.target.value)}>
                      <option value="">Select a user</option>
                      {users.map(user => <option key={user._id} value={user._id}>{user.displayName} ({user.username})</option>)}
                    </select>
                  </label>
                  <button className="submit" type="submit" disabled={loading}>Add member</button>
                </form>
              </>
            )}
          </section>
        )}

        {section === 'backlog' && (
          <section className="panel">
            <h2>Project Backlog</h2>
            <label>Select project
              <select value={selectedProjectId} onChange={event => { setSelectedProjectId(event.target.value); setFeedback(null); }}>
                <option value="">Select a project</option>
                {projects.map(project => <option key={project._id} value={project._id}>{project.name}</option>)}
              </select>
            </label>

            {!selectedProject && <p className="empty">Select a project to view its user stories.</p>}

            {selectedProject && (
              <>
                <form className="story-form" onSubmit={handleStorySubmit} noValidate>
                  <h3>{editingStoryId ? 'Edit user story' : `New user story for ${selectedProject.name}`}</h3>
                  <label>Title
                    <input name="title" value={storyForm.title} onChange={updateStoryField} placeholder="Example: View campus event details" />
                  </label>
                  <label>Description
                    <textarea name="description" value={storyForm.description} onChange={updateStoryField} placeholder="As a [type of user], I want [goal], so that [benefit]." />
                  </label>
                  <div className={editingStoryId ? 'three-column' : 'two-column'}>
                    <label>Priority
                      <select name="priority" value={storyForm.priority} onChange={updateStoryField}>
                        {PRIORITIES.map(priority => <option key={priority}>{priority}</option>)}
                      </select>
                    </label>
                    {editingStoryId && (
                      <label>Status
                        <select name="status" value={storyForm.status} onChange={updateStoryField}>
                          {STATUSES.map(status => <option key={status}>{status}</option>)}
                        </select>
                      </label>
                    )}
                    <label>Assigned member
                      <select name="assigned_user_id" value={storyForm.assigned_user_id} onChange={updateStoryField}>
                        <option value="">Unassigned</option>
                        {members.map(member => (
                          <option key={member._id} value={member._id}>
                            {member.displayName} ({member.username}){member.isLead ? ' - Project Lead' : ''}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {!editingStoryId && <p className="hint">New stories always start with the status To Do.</p>}
                  <div className="form-actions">
                    <button className="submit" type="submit" disabled={loading}>{editingStoryId ? 'Save changes' : 'Create story'}</button>
                    {editingStoryId && <button className="secondary" type="button" onClick={cancelStoryEdit}>Cancel</button>}
                  </div>
                </form>

                <div className="membership-box">
                  <h3>Stories in {selectedProject.name}</h3>
                  {!storiesLoaded ? <p className="empty">Loading stories…</p> : !stories.length ? (
                    <p className="empty">This project has no user stories yet. Use the form above to add the first one.</p>
                  ) : (
                    <div className="story-list">
                      {stories.map(story => (
                        <article className={`story-card${editingStoryId === story._id ? ' editing' : ''}`} key={story._id}>
                          <div className="story-top">
                            <h4>{story.title}</h4>
                            <div className="badges">
                              <span className={`priority ${story.priority.toLowerCase()}`}>{story.priority}</span>
                              <span className={`story-status ${statusClass(story.status)}`}>{story.status}</span>
                            </div>
                          </div>
                          <p className="lead"><strong>Assigned:</strong> {story.assigned_user ? `${story.assigned_user.displayName} (${story.assigned_user.username})` : 'Unassigned'}</p>
                          {openStoryId === story._id && <p className="story-description">{story.description}</p>}
                          <div className="story-actions">
                            <button className="secondary" type="button" onClick={() => setOpenStoryId(openStoryId === story._id ? null : story._id)}>
                              {openStoryId === story._id ? 'Hide details' : 'View details'}
                            </button>
                            <button className="secondary" type="button" disabled={loading} onClick={() => startEditingStory(story)}>Edit</button>
                            <button className="danger" type="button" disabled={loading} onClick={() => deleteStory(story)}>Delete</button>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        )}
      </section>
    </main>
  );
}

export default App;
