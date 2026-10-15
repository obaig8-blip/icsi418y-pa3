import React, { useEffect, useState } from 'react';

const emptyAccountForm = { firstName: '', lastName: '', username: '', password: '' };
const emptyProjectForm = { name: '', description: '', status: 'Planning', projectLeadId: '' };

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

  useEffect(() => {
    loadUsers();
    loadProjects();
  }, []);

  useEffect(() => {
    if (selectedProjectId) loadMembers(selectedProjectId);
    else setMembers([]);
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
      </section>
    </main>
  );
}

export default App;
