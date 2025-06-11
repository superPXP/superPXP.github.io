/**
 * Markdown编辑器管理
 */
class Editor {
    constructor() {
        // 编辑器实例
        this.editor = null;
        
        // 当前编辑的文章
        this.currentPost = null;
        
        // 是否为新文章
        this.isNewPost = true;
        
        // 本地存储键
        this.draftStorageKey = 'blog_post_draft';
        
        // 初始化
        this.init();
    }
    
    /**
     * 初始化编辑器
     */
    init() {
        // 绑定DOM元素事件
        document.getElementById('new-post-link')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.newPost();
        });
        
        document.getElementById('save-draft')?.addEventListener('click', () => this.saveDraft());
        document.getElementById('publish-post')?.addEventListener('click', () => this.publishPost());
        
        // 检查是否有保存的草稿
        this.checkSavedDraft();
    }
    
    /**
     * 初始化SimpleMDE编辑器
     */
    initEditor() {
        if (this.editor) return;
        
        const editorElement = document.getElementById('post-content');
        if (!editorElement) return;
        
        // 创建SimpleMDE实例
        this.editor = new SimpleMDE({
            element: editorElement,
            autofocus: true,
            spellChecker: false,
            status: ['lines', 'words', 'cursor'],
            renderingConfig: {
                codeSyntaxHighlighting: true,
            },
            toolbar: [
                'bold', 'italic', 'heading', '|',
                'quote', 'unordered-list', 'ordered-list', '|',
                'link', 'image', 'code', 'table', '|',
                'preview', 'side-by-side', 'fullscreen', '|',
                {
                    name: 'guide',
                    action: 'https://www.markdownguide.org/basic-syntax/',
                    className: 'fa fa-question-circle',
                    title: 'Markdown指南',
                },
                {
                    name: 'save-draft',
                    action: () => this.saveDraft(),
                    className: 'fa fa-save',
                    title: '保存草稿',
                }
            ]
        });
        
        // 添加图片上传功能
        this.setupImageUpload();
        
        // 自动保存草稿
        this.setupAutosave();
    }
    
    /**
     * 设置图片上传功能
     */
    setupImageUpload() {
        if (!this.editor) return;
        
        // 替换默认的图片处理
        const originalImageButton = this.editor.toolbar.find(item => item.name === 'image');
        if (originalImageButton && originalImageButton.action) {
            const originalAction = originalImageButton.action;
            
            originalImageButton.action = (editor) => {
                // 创建文件输入元素
                const fileInput = document.createElement('input');
                fileInput.type = 'file';
                fileInput.accept = 'image/*';
                fileInput.style.display = 'none';
                document.body.appendChild(fileInput);
                
                // 监听文件选择
                fileInput.addEventListener('change', async () => {
                    if (fileInput.files && fileInput.files[0]) {
                        try {
                            // 显示上传中提示
                            auth.showToast('正在上传图片...', 'info');
                            
                            // 上传图片
                            const result = await githubApi.uploadImage(fileInput.files[0]);
                            
                            // 插入图片Markdown
                            const imageMarkdown = `![${fileInput.files[0].name}](${result.url})`;
                            const cm = this.editor.codemirror;
                            cm.replaceSelection(imageMarkdown);
                            
                            // 显示成功提示
                            auth.showToast('图片上传成功', 'success');
                        } catch (error) {
                            console.error('图片上传失败:', error);
                            auth.showToast(`图片上传失败: ${error.message}`, 'danger');
                            
                            // 如果上传失败，回退到默认的图片插入
                            originalAction(editor);
                        } finally {
                            // 移除文件输入元素
                            document.body.removeChild(fileInput);
                        }
                    }
                });
                
                // 触发文件选择
                fileInput.click();
            };
        }
    }
    
    /**
     * 设置自动保存功能
     */
    setupAutosave() {
        if (!this.editor) return;
        
        // 每30秒自动保存一次
        setInterval(() => {
            this.saveDraft(true);
        }, 30000);
        
        // 编辑器内容变化时标记为未保存
        this.editor.codemirror.on('change', () => {
            this.isDirty = true;
        });
    }
    
    /**
     * 创建新文章
     */
    newPost() {
        // 检查是否已登录
        if (!auth.checkAuth()) return;
        
        // 显示编辑器容器
        document.getElementById('posts-container')?.classList.add('d-none');
        document.getElementById('editor-container')?.classList.remove('d-none');
        
        // 设置编辑器标题
        document.getElementById('editor-title').textContent = '新建文章';
        
        // 初始化编辑器
        this.initEditor();
        
        // 重置表单
        document.getElementById('post-title').value = '';
        document.getElementById('post-categories').value = '';
        document.getElementById('post-tags').value = '';
        this.editor.value('');
        
        // 设置为新文章
        this.currentPost = null;
        this.isNewPost = true;
    }
    
    /**
     * 编辑现有文章
     */
    editPost(post) {
        // 检查是否已登录
        if (!auth.checkAuth()) return;
        
        // 显示编辑器容器
        document.getElementById('posts-container')?.classList.add('d-none');
        document.getElementById('editor-container')?.classList.remove('d-none');
        
        // 设置编辑器标题
        document.getElementById('editor-title').textContent = '编辑文章';
        
        // 初始化编辑器
        this.initEditor();
        
        // 填充表单
        document.getElementById('post-title').value = post.title || '';
        
        // 处理分类
        if (post.categories) {
            if (Array.isArray(post.categories)) {
                document.getElementById('post-categories').value = post.categories.join(', ');
            } else {
                document.getElementById('post-categories').value = post.categories;
            }
        } else {
            document.getElementById('post-categories').value = '';
        }
        
        // 处理标签
        if (post.tags) {
            if (Array.isArray(post.tags)) {
                document.getElementById('post-tags').value = post.tags.join(', ');
            } else {
                document.getElementById('post-tags').value = post.tags;
            }
        } else {
            document.getElementById('post-tags').value = '';
        }
        
        // 设置编辑器内容
        this.editor.value(post.body || '');
        
        // 保存当前编辑的文章
        this.currentPost = post;
        this.isNewPost = false;
    }
    
    /**
     * 保存草稿
     */
    saveDraft(silent = false) {
        if (!this.editor) return;
        
        try {
            // 获取表单数据
            const title = document.getElementById('post-title').value;
            const categories = document.getElementById('post-categories').value;
            const tags = document.getElementById('post-tags').value;
            const content = this.editor.value();
            
            // 创建草稿对象
            const draft = {
                title,
                categories: categories.split(',').map(c => c.trim()).filter(c => c),
                tags: tags.split(',').map(t => t.trim()).filter(t => t),
                body: content,
                timestamp: new Date().toISOString()
            };
            
            // 如果是编辑现有文章，保存原始信息
            if (this.currentPost) {
                draft.originalPost = {
                    name: this.currentPost.name,
                    path: this.currentPost.path,
                    sha: this.currentPost.sha
                };
            }
            
            // 保存到本地存储
            localStorage.setItem(this.draftStorageKey, JSON.stringify(draft));
            
            // 重置脏标记
            this.isDirty = false;
            
            // 显示提示（除非是静默保存）
            if (!silent) {
                auth.showToast('草稿已保存', 'success');
            }
        } catch (error) {
            console.error('保存草稿失败:', error);
            if (!silent) {
                auth.showToast('保存草稿失败', 'danger');
            }
        }
    }
    
    /**
     * 检查是否有保存的草稿
     */
    checkSavedDraft() {
        try {
            const savedDraft = localStorage.getItem(this.draftStorageKey);
            if (!savedDraft) return;
            
            const draft = JSON.parse(savedDraft);
            if (!draft || !draft.timestamp) return;
            
            // 计算草稿保存时间
            const savedTime = new Date(draft.timestamp);
            const now = new Date();
            const hoursDiff = (now - savedTime) / (1000 * 60 * 60);
            
            // 如果草稿保存时间超过24小时，不提示恢复
            if (hoursDiff > 24) return;
            
            // 创建提示框
            const toastContainer = document.getElementById('toast-container');
            if (!toastContainer) return;
            
            const toast = document.createElement('div');
            toast.className = 'toast align-items-center text-white bg-info border-0';
            toast.setAttribute('role', 'alert');
            toast.setAttribute('aria-live', 'assertive');
            toast.setAttribute('aria-atomic', 'true');
            
            toast.innerHTML = `
                <div class="d-flex">
                    <div class="toast-body">
                        发现保存的草稿（${this.formatTime(savedTime)}）
                    </div>
                    <div class="d-flex align-items-center me-2">
                        <button type="button" class="btn btn-sm btn-light me-2" id="restore-draft">恢复</button>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast"></button>
                    </div>
                </div>
            `;
            
            toastContainer.appendChild(toast);
            
            const bsToast = new bootstrap.Toast(toast, {
                autohide: false
            });
            
            bsToast.show();
            
            // 绑定恢复按钮事件
            document.getElementById('restore-draft')?.addEventListener('click', () => {
                this.restoreDraft(draft);
                bsToast.hide();
            });
            
            // 自动移除
            toast.addEventListener('hidden.bs.toast', () => {
                toast.remove();
            });
        } catch (error) {
            console.error('检查草稿失败:', error);
        }
    }
    
    /**
     * 恢复草稿
     */
    restoreDraft(draft) {
        // 检查是否已登录
        if (!auth.checkAuth()) return;
        
        // 显示编辑器容器
        document.getElementById('posts-container')?.classList.add('d-none');
        document.getElementById('editor-container')?.classList.remove('d-none');
        
        // 初始化编辑器
        this.initEditor();
        
        // 填充表单
        document.getElementById('post-title').value = draft.title || '';
        
        // 处理分类
        if (draft.categories) {
            if (Array.isArray(draft.categories)) {
                document.getElementById('post-categories').value = draft.categories.join(', ');
            } else {
                document.getElementById('post-categories').value = draft.categories;
            }
        }
        
        // 处理标签
        if (draft.tags) {
            if (Array.isArray(draft.tags)) {
                document.getElementById('post-tags').value = draft.tags.join(', ');
            } else {
                document.getElementById('post-tags').value = draft.tags;
            }
        }
        
        // 设置编辑器内容
        this.editor.value(draft.body || '');
        
        // 如果是编辑现有文章，恢复原始信息
        if (draft.originalPost) {
            this.currentPost = {
                ...draft.originalPost,
                title: draft.title,
                body: draft.body
            };
            this.isNewPost = false;
            document.getElementById('editor-title').textContent = '编辑文章';
        } else {
            this.currentPost = null;
            this.isNewPost = true;
            document.getElementById('editor-title').textContent = '新建文章';
        }
        
        // 显示提示
        auth.showToast('草稿已恢复', 'success');
    }
    
    /**
     * 发布文章
     */
    async publishPost() {
        try {
            // 检查是否已登录
            if (!auth.checkAuth()) return;
            
            // 获取表单数据
            const title = document.getElementById('post-title').value.trim();
            const categories = document.getElementById('post-categories').value;
            const tags = document.getElementById('post-tags').value;
            const content = this.editor.value();
            
            // 验证标题
            if (!title) {
                auth.showToast('请输入文章标题', 'warning');
                return;
            }
            
            // 显示加载提示
            auth.showToast('正在发布文章...', 'info');
            
            // 准备文章数据
            const post = {
                title,
                categories: categories.split(',').map(c => c.trim()).filter(c => c),
                tags: tags.split(',').map(t => t.trim()).filter(t => t),
                body: content,
                date: new Date().toISOString()
            };
            
            // 如果是编辑现有文章，添加原始信息
            if (!this.isNewPost && this.currentPost) {
                post.name = this.currentPost.name;
                post.path = this.currentPost.path;
                post.sha = this.currentPost.sha;
            }
            
            // 保存文章
            const result = await githubApi.savePost(post);
            
            // 清除草稿
            localStorage.removeItem(this.draftStorageKey);
            
            // 显示成功提示
            auth.showToast(`文章已${this.isNewPost ? '发布' : '更新'}`, 'success');
            
            // 返回文章列表
            setTimeout(() => {
                document.getElementById('posts-link').click();
            }, 1000);
        } catch (error) {
            console.error('发布文章失败:', error);
            auth.showToast(`发布失败: ${error.message}`, 'danger');
        }
    }
    
    /**
     * 格式化时间
     */
    formatTime(date) {
        if (!(date instanceof Date)) {
            date = new Date(date);
        }
        
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / (1000 * 60));
        
        if (diffMins < 1) {
            return '刚刚';
        } else if (diffMins < 60) {
            return `${diffMins}分钟前`;
        } else if (diffMins < 24 * 60) {
            const hours = Math.floor(diffMins / 60);
            return `${hours}小时前`;
        } else {
            return date.toLocaleString();
        }
    }
}

// 创建全局编辑器实例
const editor = new Editor();