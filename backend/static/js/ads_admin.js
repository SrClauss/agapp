// Global state
let currentAdId = null;
let adminToken = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Get token from localStorage or prompt
    adminToken = localStorage.getItem('admin_token');
    if (!adminToken) {
        adminToken = prompt('Digite o token de admin:');
        if (adminToken) {
            localStorage.setItem('admin_token', adminToken);
        }
    }

    // Setup tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // Setup form
    document.getElementById('create-ad-form').addEventListener('submit', handleCreateAd);

    // Setup upload zone
    const uploadZone = document.getElementById('upload-zone');
    const fileInput = document.getElementById('file-input');

    uploadZone.addEventListener('click', () => fileInput.click());
    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('dragover');
    });
    uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('dragover');
    });
    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    });

    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });

    // Load initial data
    loadAds();
    loadAssignments();
});

function switchTab(tabName) {
    // Update tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Update content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`tab-${tabName}`).classList.add('active');

    // Load data if needed
    if (tabName === 'ads') {
        loadAds();
    } else if (tabName === 'assignments') {
        loadAssignments();
    } else if (tabName === 'analytics') {
        loadAnalytics();
    }
}

async function loadAds() {
    try {
        const response = await fetch('/ads/ad-contents', {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });

        if (!response.ok) throw new Error('Failed to load ads');

        const ads = await response.json();
        renderAds(ads);
    } catch (error) {
        console.error('Error loading ads:', error);
        showAlert('error', 'Erro ao carregar anúncios: ' + error.message);
    }
}

function renderAds(ads) {
    const container = document.getElementById('ads-list');

    if (ads.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #a0aec0; padding: 60px;">Nenhum anúncio criado ainda. Crie seu primeiro anúncio!</p>';
        return;
    }

    container.innerHTML = ads.map(ad => `
        <div class="ad-card">
            <div class="ad-card-header">
                <div>
                    <div class="ad-card-title">${ad.title}</div>
                    <div class="ad-card-alias">${ad.alias}</div>
                </div>
                <div>
                    <span class="ad-badge badge-${ad.type === 'publi_screen' ? 'publi' : 'banner'}">
                        ${ad.type === 'publi_screen' ? 'PubliScreen' : 'Banner'}
                    </span>
                    <span class="ad-badge badge-${ad.is_active ? 'active' : 'inactive'}">
                        ${ad.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                </div>
            </div>

            <div class="ad-stats">
                <div class="stat">
                    <div class="stat-value">${ad.views || 0}</div>
                    <div class="stat-label">Views</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${ad.clicks || 0}</div>
                    <div class="stat-label">Clicks</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${ad.views > 0 ? ((ad.clicks / ad.views) * 100).toFixed(1) : 0}%</div>
                    <div class="stat-label">CTR</div>
                </div>
            </div>

            <div style="color: #718096; font-size: 13px; margin-bottom: 12px;">
                <div>📁 ${ad.css_files.length} CSS, ${ad.js_files.length} JS, ${ad.image_files.length} imagens</div>
                <div>🎯 Target: ${ad.target}</div>
                <div>⭐ Prioridade: ${ad.priority}</div>
            </div>

            <div class="ad-card-actions">
                <button class="btn btn-secondary" onclick="openUploadModal('${ad.id}')">
                    📤 Upload
                </button>
                <button class="btn btn-secondary" onclick="previewAd('${ad.id}')">
                    👁️ Preview
                </button>
                <button class="btn btn-${ad.is_active ? 'secondary' : 'success'}" onclick="toggleAdActive('${ad.id}', ${!ad.is_active})">
                    ${ad.is_active ? '⏸️ Desativar' : '▶️ Ativar'}
                </button>
                <button class="btn btn-danger" onclick="deleteAd('${ad.id}')">
                    🗑️
                </button>
            </div>
        </div>
    `).join('');
}

async function handleCreateAd(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const data = {
        alias: formData.get('alias'),
        type: formData.get('type'),
        target: formData.get('target'),
        title: formData.get('title'),
        description: formData.get('description'),
        priority: parseInt(formData.get('priority'))
    };

    try {
        const response = await fetch('/ads/ad-contents', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to create ad');
        }

        const ad = await response.json();
        showAlert('success', `Anúncio "${ad.title}" criado com sucesso!`);
        e.target.reset();

        // Switch to ads tab and open upload modal
        switchTab('ads');
        setTimeout(() => openUploadModal(ad.id), 500);
    } catch (error) {
        console.error('Error creating ad:', error);
        showAlert('error', 'Erro ao criar anúncio: ' + error.message);
    }
}

function openUploadModal(adId) {
    currentAdId = adId;
    document.getElementById('upload-modal').classList.add('active');
    document.getElementById('files-to-upload').innerHTML = '';
    document.getElementById('file-input').value = '';
}

function closeUploadModal() {
    document.getElementById('upload-modal').classList.remove('active');
    currentAdId = null;
}

function handleFiles(files) {
    const container = document.getElementById('files-to-upload');
    const fileArray = Array.from(files);

    container.innerHTML = '<ul class="file-list">' +
        fileArray.map((file, index) => {
            const type = getFileType(file.name);
            return `
                <li class="file-item">
                    <div>
                        <span class="file-item-name">${file.name}</span>
                        <span class="file-item-size">(${formatFileSize(file.size)})</span>
                        <span class="ad-badge" style="margin-left: 8px;">${type}</span>
                    </div>
                    <div class="file-item-actions">
                        <button class="btn btn-danger" onclick="removeFile(${index})" style="padding: 6px 12px; font-size: 12px;">
                            Remover
                        </button>
                    </div>
                </li>
            `;
        }).join('') +
        '</ul>';

    // Store files for upload
    window.filesToUpload = fileArray;
}

function removeFile(index) {
    window.filesToUpload.splice(index, 1);
    handleFiles(window.filesToUpload);
}

function getFileType(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    if (ext === 'html' || ext === 'htm') return 'html';
    if (ext === 'css') return 'css';
    if (ext === 'js') return 'js';
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) return 'image';
    return 'unknown';
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

async function uploadFiles() {
    if (!window.filesToUpload || window.filesToUpload.length === 0) {
        showUploadAlert('error', 'Selecione pelo menos um arquivo');
        return;
    }

    const uploadBtn = document.getElementById('upload-btn');
    uploadBtn.disabled = true;
    uploadBtn.innerHTML = '<span class="loading"></span> <span>Enviando...</span>';

    let successCount = 0;
    let errorCount = 0;

    for (const file of window.filesToUpload) {
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('file_type', getFileType(file.name));

            const response = await fetch(`/ads/ad-contents/${currentAdId}/files`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${adminToken}`
                },
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Failed to upload ${file.name}`);
            }

            successCount++;
        } catch (error) {
            console.error('Error uploading file:', error);
            errorCount++;
        }
    }

    uploadBtn.disabled = false;
    uploadBtn.innerHTML = '<span>Upload Arquivos</span>';

    if (errorCount === 0) {
        showUploadAlert('success', `${successCount} arquivo(s) enviado(s) com sucesso!`);
        setTimeout(() => {
            closeUploadModal();
            loadAds();
        }, 1500);
    } else {
        showUploadAlert('error', `${successCount} enviado(s), ${errorCount} erro(s)`);
    }
}

async function toggleAdActive(adId, isActive) {
    try {
        const response = await fetch(`/ads/ad-contents/${adId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ is_active: isActive })
        });

        if (!response.ok) throw new Error('Failed to update ad');

        showAlert('success', `Anúncio ${isActive ? 'ativado' : 'desativado'} com sucesso!`);
        loadAds();
    } catch (error) {
        console.error('Error toggling ad:', error);
        showAlert('error', 'Erro ao atualizar anúncio: ' + error.message);
    }
}

async function deleteAd(adId) {
    if (!confirm('Tem certeza que deseja deletar este anúncio? Esta ação não pode ser desfeita.')) {
        return;
    }

    try {
        const response = await fetch(`/ads/ad-contents/${adId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });

        if (!response.ok) throw new Error('Failed to delete ad');

        showAlert('success', 'Anúncio deletado com sucesso!');
        loadAds();
        loadAssignments();
    } catch (error) {
        console.error('Error deleting ad:', error);
        showAlert('error', 'Erro ao deletar anúncio: ' + error.message);
    }
}

async function previewAd(adId) {
    try {
        const response = await fetch(`/ads/ad-contents/${adId}`, {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });

        if (!response.ok) throw new Error('Failed to load ad');

        const ad = await response.json();

        // Get file content
        const contentResponse = await fetch(`/ads/public/ads/publi_screen_client`, {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });

        if (contentResponse.ok) {
            const content = await contentResponse.json();

            // Build HTML
            const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>${content.css}</style>
                </head>
                <body>
                    ${content.html}
                    <script>${content.js}</script>
                </body>
                </html>
            `;

            // Show in iframe
            const iframe = document.getElementById('preview-frame');
            iframe.srcdoc = html;
            document.getElementById('preview-modal').classList.add('active');
        }
    } catch (error) {
        console.error('Error previewing ad:', error);
        showAlert('error', 'Erro ao carregar preview: ' + error.message);
    }
}

function closePreviewModal() {
    document.getElementById('preview-modal').classList.remove('active');
}

async function loadAssignments() {
    try {
        const [assignmentsRes, adsRes] = await Promise.all([
            fetch('/ads/ad-assignments', {
                headers: { 'Authorization': `Bearer ${adminToken}` }
            }),
            fetch('/ads/ad-contents', {
                headers: { 'Authorization': `Bearer ${adminToken}` }
            })
        ]);

        if (!assignmentsRes.ok || !adsRes.ok) throw new Error('Failed to load data');

        const assignments = await assignmentsRes.json();
        const ads = await adsRes.json();

        renderAssignments(assignments, ads);
    } catch (error) {
        console.error('Error loading assignments:', error);
        showAlert('error', 'Erro ao carregar atribuições: ' + error.message);
    }
}

function renderAssignments(assignments, ads) {
    const locations = [
        { id: 'publi_screen_client', name: 'PubliScreen Cliente' },
        { id: 'publi_screen_professional', name: 'PubliScreen Profissional' },
        { id: 'banner_client_home', name: 'Banner Home Cliente' },
        { id: 'banner_professional_home', name: 'Banner Home Profissional' }
    ];

    const container = document.getElementById('assignments-list');

    container.innerHTML = locations.map(location => {
        const assignment = assignments.find(a => a.location === location.id);
        const ad = assignment ? ads.find(a => a.id === assignment.ad_content_id) : null;

        return `
            <div class="assignment-card">
                <div class="assignment-location">${location.name}</div>
                <div class="assignment-ad">
                    ${ad ? `
                        <div style="margin: 12px 0;">
                            <strong>${ad.title}</strong><br>
                            <span style="font-family: monospace; color: #a0aec0;">${ad.alias}</span>
                        </div>
                        <button class="btn btn-danger" onclick="deleteAssignment('${location.id}')" style="font-size: 12px; padding: 6px 12px;">
                            Remover
                        </button>
                    ` : `
                        <div style="color: #a0aec0; margin: 12px 0;">Nenhum anúncio atribuído</div>
                        <select id="assign-${location.id}" class="form-group" style="margin-bottom: 8px;">
                            <option value="">Selecione um anúncio...</option>
                            ${ads.filter(a => a.is_active).map(a => `
                                <option value="${a.id}">${a.title}</option>
                            `).join('')}
                        </select>
                        <button class="btn btn-primary" onclick="createAssignment('${location.id}')" style="font-size: 12px; padding: 6px 12px;">
                            Atribuir
                        </button>
                    `}
                </div>
            </div>
        `;
    }).join('');
}

async function createAssignment(location) {
    const select = document.getElementById(`assign-${location}`);
    const adId = select.value;

    if (!adId) {
        alert('Selecione um anúncio');
        return;
    }

    try {
        const response = await fetch('/ads/ad-assignments', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                location: location,
                ad_content_id: adId
            })
        });

        if (!response.ok) throw new Error('Failed to create assignment');

        showAlert('success', 'Atribuição criada com sucesso!');
        loadAssignments();
    } catch (error) {
        console.error('Error creating assignment:', error);
        showAlert('error', 'Erro ao criar atribuição: ' + error.message);
    }
}

async function deleteAssignment(location) {
    if (!confirm('Deseja remover esta atribuição?')) return;

    try {
        const response = await fetch(`/ads/ad-assignments/${location}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });

        if (!response.ok) throw new Error('Failed to delete assignment');

        showAlert('success', 'Atribuição removida com sucesso!');
        loadAssignments();
    } catch (error) {
        console.error('Error deleting assignment:', error);
        showAlert('error', 'Erro ao remover atribuição: ' + error.message);
    }
}

async function loadAnalytics() {
    try {
        const response = await fetch('/ads/ad-contents', {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });

        if (!response.ok) throw new Error('Failed to load analytics');

        const ads = await response.json();

        const totalViews = ads.reduce((sum, ad) => sum + (ad.views || 0), 0);
        const totalClicks = ads.reduce((sum, ad) => sum + (ad.clicks || 0), 0);
        const avgCTR = totalViews > 0 ? (totalClicks / totalViews) * 100 : 0;

        const container = document.getElementById('analytics-content');
        container.innerHTML = `
            <div class="ad-stats" style="margin-bottom: 30px;">
                <div class="stat">
                    <div class="stat-value">${totalViews}</div>
                    <div class="stat-label">Total de Views</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${totalClicks}</div>
                    <div class="stat-label">Total de Clicks</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${avgCTR.toFixed(2)}%</div>
                    <div class="stat-label">CTR Médio</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${ads.filter(a => a.is_active).length}</div>
                    <div class="stat-label">Anúncios Ativos</div>
                </div>
            </div>

            <h3 style="margin-bottom: 16px;">Performance por Anúncio</h3>
            <div class="ads-grid">
                ${ads.sort((a, b) => (b.views || 0) - (a.views || 0)).map(ad => `
                    <div class="ad-card">
                        <div class="ad-card-title">${ad.title}</div>
                        <div class="ad-card-alias">${ad.alias}</div>

                        <div class="ad-stats" style="margin-top: 16px;">
                            <div class="stat">
                                <div class="stat-value">${ad.views || 0}</div>
                                <div class="stat-label">Views</div>
                            </div>
                            <div class="stat">
                                <div class="stat-value">${ad.clicks || 0}</div>
                                <div class="stat-label">Clicks</div>
                            </div>
                            <div class="stat">
                                <div class="stat-value">${ad.views > 0 ? ((ad.clicks / ad.views) * 100).toFixed(1) : 0}%</div>
                                <div class="stat-label">CTR</div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    } catch (error) {
        console.error('Error loading analytics:', error);
        showAlert('error', 'Erro ao carregar analytics: ' + error.message);
    }
}

function showAlert(type, message) {
    const alerts = document.querySelectorAll('.alert');
    alerts.forEach(alert => alert.remove());

    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;

    const container = document.querySelector('.container');
    container.insertBefore(alert, container.firstChild);

    setTimeout(() => alert.remove(), 5000);
}

function showUploadAlert(type, message) {
    const container = document.getElementById('upload-alert');
    container.innerHTML = `<div class="alert alert-${type}">${message}</div>`;

    setTimeout(() => {
        container.innerHTML = '';
    }, 5000);
}
