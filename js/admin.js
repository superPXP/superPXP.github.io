/**
 * 博客管理系统主要逻辑
 */
class Admin {
    constructor() {
        // 文章列表
        this.posts = [];
        
        // 初始化
        this.init();
    }
    
    /**
     * 初始化应用
     */
    init() {
        // 绑定事件处理
        this.bindEvents();
        
        // 检查认证状态
        if (auth.checkAuth()) {
            this.loadPosts();
        }
    }
    
    /**
     * 绑定事件处理
     */
    bindEvents() {
        // 文章列表链接
        document.getElementById('posts-link')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showPostsList();
        });
        
        // 刷新按钮
        document.getElementById('refresh-posts')?.addEventListener('click', () => {
            this.loadPosts();
        });
        
        // 页面离开提示
        window.addEventListener('beforeunload', (e) => {
            if (editor && editor.isDirty) {
                e.preventDefault();
                e.returnValue = '您有未保存的更改，确定要离开吗？';
                return e.returnValue;
            }
        });
    }
    
    /**
     * 加载文章列表
     */
    async loadPosts() {
        try {
            // 显示加载提示
            document.getElementById('loading-posts')?.classList.remove('d-none');
            document.getElementById('no-posts')?.classList.add('d-none');
            
            const postsList = document.getElementById('posts-list');
            if (postsList) {
                postsList.innerHTML = '';
            }
            
            // 获取文章列表
            this.posts = await githubApi.fetchPosts();
            
            // 更新UI
            this.updatePostsList();
        } catch (error) {
            console.error('加载文章列表失败:', error);
            auth.showToast(`加载文章列表失败: ${error.message}`, 'danger');
        } finally {
            document.getElementById('loading-posts')?.classList.add('d-none');
        }
    }
    
    /**
     * 更新文章列表UI
     */
    updatePostsList() {
        const postsList = document.getElementById('posts-list');
        if (!postsList) return;
        
        if (this.posts.length === 0) {
            document.getElementById('no-posts')?.classList.remove('d-none');
            return;
        }
        
        // 清空列表
        postsList.innerHTML = '';
        
        // 添加文章
        this.posts.forEach(post => {
            const tr = document.createElement('tr');
            
            // 标题列
            const titleTd = document.createElement('td');
            titleTd.textContent = post.title || post.name;
            tr.appendChild(titleTd);
            
            // 日期列
            const dateTd = document.createElement('td');
            dateTd.textContent = post.date ? new Date(post.date).toLocaleDateString() : '-';
            tr.appendChild(dateTd);
            
            // 分类列
            const categoriesTd = document.createElement('td');
            if (post.categories) {
                if (Array.isArray(post.categories)) {
                    categoriesTd.textContent = post.categories.join(', ');
                } else {
                    categoriesTd.textContent = post.categories;
                }
            } else {
                categoriesTd.textContent = '-';
            }
            tr.appendChild(categoriesTd);
            
            // 标签列
            const tagsTd = document.createElement('td');
            if (post.tags) {
                if (Array.isArray(post.tags)) {
                    tagsTd.textContent = post.tags.join(', ');
                } else {
                    tagsTd.textContent = post.tags;
                }
            } else {
                tagsTd.textContent = '-';
            }
            tr.appendChild(tagsTd);
            
            // 操作列
            const actionsTd = document.createElement('td');
            actionsTd.className = 'text-end';
            
            // 编辑按钮
            const editBtn = document.createElement('button');
            editBtn.className = 'btn btn-sm btn-outline-primary me-2';
            editBtn.innerHTML = '<i class="bi bi-pencil"></i> 编辑';
            editBtn.addEventListener('click', () => this.editPost(post));
            actionsTd.appendChild(editBtn);
            
            // 删除按钮
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn btn-sm btn-outline-danger';
            deleteBtn.innerHTML = '<i class="bi bi-trash"></i> 删除';
            deleteBtn.addEventListener('click', () => this.deletePost(post));
            actionsTd.appendChild(deleteBtn);
            
            tr.appendChild(actionsTd);
            
            // 添加到列表
            postsList.appendChild(tr);
        });
    }
    
    /**
     * 显示文章列表
     */
    showPostsList() {
        document.getElementById('editor-container')?.classList.add('d-none');
        document.getElementById('posts-container')?.classList.remove('d-none');
        
        // 如果文章列表为空，重新加载
        if (this.posts.length === 0) {
            this.loadPosts();
        }
    }
    
    /**
     * 编辑文章
     */
    editPost(post) {
        editor.editPost(post);
    }
    
    /**
     * 删除文章
     */
    deletePost(post) {
        // 显示确认对话框
        const confirmModal = document.getElementById('confirm-modal');
        if (!confirmModal) return;
        
        const modal = new bootstrap.Modal(confirmModal);
        
        // 设置对话框内容
        document.getElementById('confirm-title').textContent = '删除文章';
        document.getElementById('confirm-message').textContent = `确定要删除文章"${post.title || post.name}"吗？此操作不可恢复。`;
        
        // 绑定确认按钮事件
        const confirmButton = document.getElementById('confirm-button');
        const originalOnClick = confirmButton.onclick;
        
        confirmButton.onclick = async () => {
            try {
                // 显示加载提示
                auth.showToast('正在删除文章...', 'info');
                
                // 删除文章
                await githubApi.deletePost(post);
                
                // 从列表中移除
                this.posts = this.posts.filter(p => p.path !== post.path);
                this.updatePostsList();
                
                // 显示成功提示
                auth.showToast('文章已删除', 'success');
            } catch (error) {
                console.error('删除文章失败:', error);
                auth.showToast(`删除失败: ${error.message}`, 'danger');
            } finally {
                // 关闭对话框
                modal.hide();
                
                // 恢复原始事件处理
                confirmButton.onclick = originalOnClick;
            }
        };
        
        // 显示对话框
        modal.show();
    }
}

// 创建全局管理实例
const admin = new Admin();