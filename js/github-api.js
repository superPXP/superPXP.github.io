/**
 * GitHub API封装
 */
class GitHubAPI {
    constructor() {
        // 仓库所有者和名称
        this.owner = ''; // 将在初始化时设置
        this.repo = '';  // 将在初始化时设置
        
        // API基础URL
        this.apiBaseUrl = 'https://api.github.com';
        
        // CORS代理URL（用于绕过GitHub API的CORS限制）
        this.corsProxy = 'https://cors-anywhere.herokuapp.com/';
        
        // 文章目录路径
        this.postsPath = 'source/_posts';
        
        // 初始化
        this.init();
    }
    
    /**
     * 初始化API
     */
    async init() {
        try {
            // 从当前URL获取仓库信息
            const repoInfo = this.getRepoInfoFromUrl();
            if (repoInfo) {
                this.owner = repoInfo.owner;
                this.repo = repoInfo.repo;
            } else {
                // 如果无法从URL获取，尝试从用户信息获取
                await this.setRepoFromUserInfo();
            }
            
            console.log(`GitHub API 初始化: ${this.owner}/${this.repo}`);
        } catch (error) {
            console.error('GitHub API 初始化失败:', error);
        }
    }
    
    /**
     * 从URL获取仓库信息
     */
    getRepoInfoFromUrl() {
        // 尝试从URL中提取GitHub用户名和仓库名
        // 例如从 username.github.io/repo 或 github.com/username/repo
        const hostname = window.location.hostname;
        const pathname = window.location.pathname.split('/')[1];
        
        if (hostname.endsWith('github.io')) {
            // 格式: username.github.io/repo
            const owner = hostname.replace('.github.io', '');
            const repo = pathname || owner + '.github.io';
            return { owner, repo };
        }
        
        return null;
    }
    
    /**
     * 从用户信息设置仓库
     */
    async setRepoFromUserInfo() {
        try {
            if (!auth || !auth.user) {
                throw new Error('用户未登录');
            }
            
            // 获取用户的仓库列表
            const repos = await this.fetchUserRepos();
            
            // 查找可能的博客仓库（优先查找 username.github.io）
            const blogRepo = repos.find(repo => 
                repo.name === `${auth.user.login}.github.io` || 
                repo.name.includes('blog') || 
                repo.name.includes('hexo')
            );
            
            if (blogRepo) {
                this.owner = blogRepo.owner.login;
                this.repo = blogRepo.name;
            } else if (repos.length > 0) {
                // 如果没有找到明显的博客仓库，使用第一个仓库
                this.owner = repos[0].owner.login;
                this.repo = repos[0].name;
            } else {
                throw new Error('未找到可用的仓库');
            }
        } catch (error) {
            console.error('设置仓库失败:', error);
            throw error;
        }
    }
    
    /**
     * 获取用户的仓库列表
     */
    async fetchUserRepos() {
        try {
            const token = auth.getToken();
            if (!token) throw new Error('未授权');
            
            const response = await fetch(`${this.apiBaseUrl}/user/repos?sort=updated&per_page=100`, {
                headers: {
                    'Authorization': `token ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`GitHub API错误: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('获取仓库列表失败:', error);
            return [];
        }
    }
    
    /**
     * 获取文章列表
     */
    async fetchPosts() {
        try {
            const token = auth.getToken();
            if (!token) throw new Error('未授权');
            
            // 获取_posts目录内容
            const response = await fetch(`${this.apiBaseUrl}/repos/${this.owner}/${this.repo}/contents/${this.postsPath}`, {
                headers: {
                    'Authorization': `token ${token}`
                }
            });
            
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error(`未找到文章目录: ${this.postsPath}`);
                }
                throw new Error(`GitHub API错误: ${response.status}`);
            }
            
            const files = await response.json();
            
            // 过滤出.md文件
            const mdFiles = files.filter(file => file.name.endsWith('.md'));
            
            // 获取每个文件的内容
            const posts = await Promise.all(mdFiles.map(async file => {
                try {
                    const content = await this.fetchFileContent(file.path);
                    const metadata = this.parsePostMetadata(content);
                    
                    return {
                        path: file.path,
                        name: file.name,
                        sha: file.sha,
                        content: content,
                        ...metadata
                    };
                } catch (error) {
                    console.error(`获取文件内容失败: ${file.name}`, error);
                    return {
                        path: file.path,
                        name: file.name,
                        sha: file.sha,
                        error: error.message
                    };
                }
            }));
            
            // 按日期排序
            return posts.sort((a, b) => {
                const dateA = a.date ? new Date(a.date) : new Date(0);
                const dateB = b.date ? new Date(b.date) : new Date(0);
                return dateB - dateA;
            });
        } catch (error) {
            console.error('获取文章列表失败:', error);
            throw error;
        }
    }
    
    /**
     * 获取文件内容
     */
    async fetchFileContent(path) {
        try {
            const token = auth.getToken();
            if (!token) throw new Error('未授权');
            
            const response = await fetch(`${this.apiBaseUrl}/repos/${this.owner}/${this.repo}/contents/${path}`, {
                headers: {
                    'Authorization': `token ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`GitHub API错误: ${response.status}`);
            }
            
            const data = await response.json();
            
            // GitHub API返回的是Base64编码的内容
            return atob(data.content);
        } catch (error) {
            console.error(`获取文件内容失败: ${path}`, error);
            throw error;
        }
    }
    
    /**
     * 解析文章元数据
     */
    parsePostMetadata(content) {
        try {
            const metadata = {};
            
            // 查找YAML前置元数据
            const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
            
            if (match && match[1]) {
                const yamlContent = match[1];
                
                // 解析YAML
                const lines = yamlContent.split('\n');
                for (const line of lines) {
                    const colonIndex = line.indexOf(':');
                    if (colonIndex > 0) {
                        const key = line.substring(0, colonIndex).trim();
                        let value = line.substring(colonIndex + 1).trim();
                        
                        // 处理数组格式 (例如: tags: [tag1, tag2])
                        if (value.startsWith('[') && value.endsWith(']')) {
                            value = value.substring(1, value.length - 1)
                                .split(',')
                                .map(item => item.trim());
                        }
                        
                        metadata[key] = value;
                    }
                }
                
                // 提取正文内容（去除YAML前置元数据）
                metadata.body = content.substring(match[0].length);
            } else {
                metadata.body = content;
            }
            
            return metadata;
        } catch (error) {
            console.error('解析文章元数据失败:', error);
            return { body: content };
        }
    }
    
    /**
     * 创建或更新文章
     */
    async savePost(post) {
        try {
            const token = auth.getToken();
            if (!token) throw new Error('未授权');
            
            // 构建文件名
            let fileName = post.name;
            if (!fileName) {
                // 如果没有提供文件名，根据标题生成
                const slug = post.title
                    .toLowerCase()
                    .replace(/[^\w\u4e00-\u9fa5]+/g, '-') // 将非字母数字汉字字符替换为连字符
                    .replace(/^-+|-+$/g, ''); // 移除首尾连字符
                
                fileName = `${slug}.md`;
            }
            
            // 构建文件路径
            const filePath = `${this.postsPath}/${fileName}`;
            
            // 构建文件内容
            let content = '---\n';
            content += `title: ${post.title}\n`;
            content += `date: ${post.date || new Date().toISOString()}\n`;
            
            if (post.categories) {
                if (Array.isArray(post.categories)) {
                    content += `categories: [${post.categories.join(', ')}]\n`;
                } else {
                    content += `categories: ${post.categories}\n`;
                }
            }
            
            if (post.tags) {
                if (Array.isArray(post.tags)) {
                    content += `tags: [${post.tags.join(', ')}]\n`;
                } else {
                    content += `tags: ${post.tags}\n`;
                }
            }
            
            content += '---\n\n';
            content += post.body || '';
            
            // Base64编码内容
            const encodedContent = btoa(unescape(encodeURIComponent(content)));
            
            // 构建请求体
            const requestBody = {
                message: post.sha ? `更新文章: ${post.title}` : `创建文章: ${post.title}`,
                content: encodedContent
            };
            
            // 如果是更新现有文件，需要提供SHA
            if (post.sha) {
                requestBody.sha = post.sha;
            }
            
            // 发送请求
            const response = await fetch(`${this.apiBaseUrl}/repos/${this.owner}/${this.repo}/contents/${filePath}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`GitHub API错误: ${response.status} - ${errorData.message}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('保存文章失败:', error);
            throw error;
        }
    }
    
    /**
     * 删除文章
     */
    async deletePost(post) {
        try {
            const token = auth.getToken();
            if (!token) throw new Error('未授权');
            
            if (!post.sha) {
                throw new Error('缺少文件SHA，无法删除');
            }
            
            // 构建请求体
            const requestBody = {
                message: `删除文章: ${post.name || post.title}`,
                sha: post.sha
            };
            
            // 发送请求
            const response = await fetch(`${this.apiBaseUrl}/repos/${this.owner}/${this.repo}/contents/${post.path}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `token ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`GitHub API错误: ${response.status} - ${errorData.message}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('删除文章失败:', error);
            throw error;
        }
    }
    
    /**
     * 上传图片
     */
    async uploadImage(file) {
        try {
            const token = auth.getToken();
            if (!token) throw new Error('未授权');
            
            // 读取文件内容
            const reader = new FileReader();
            const fileContent = await new Promise((resolve, reject) => {
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
            
            // 提取Base64内容
            const base64Content = fileContent.split(',')[1];
            
            // 构建图片路径
            const timestamp = new Date().getTime();
            const imagePath = `source/images/${timestamp}-${file.name}`;
            
            // 构建请求体
            const requestBody = {
                message: `上传图片: ${file.name}`,
                content: base64Content
            };
            
            // 发送请求
            const response = await fetch(`${this.apiBaseUrl}/repos/${this.owner}/${this.repo}/contents/${imagePath}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`GitHub API错误: ${response.status} - ${errorData.message}`);
            }
            
            const responseData = await response.json();
            
            // 返回图片URL
            return {
                url: responseData.content.download_url,
                path: imagePath
            };
        } catch (error) {
            console.error('上传图片失败:', error);
            throw error;
        }
    }
}

// 创建全局API实例
const githubApi = new GitHubAPI();