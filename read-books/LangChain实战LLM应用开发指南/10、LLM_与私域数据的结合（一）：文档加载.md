大家好，欢迎继续学习 LangChain 实战课程。

上一节我们学习的函数调用，增强了 LLM 与外部系统的集成能力。而今天我们要介绍的`RAG（Retrieval Augmented Generation）`，则是**一种用于增强 LLM 与私域数据交互能力的技术**。

RAG，全称 Retrieval Augmented Generation（检索增强生成），通过为 LLM 提供外部数据，生成更准确和更符合上下文的答案。

我们前面反复提到过 LLM 的局限：无法对训练集以外的知识生成准确的答案，甚至会产生 “幻觉”，胡乱作答。

但其实，经过大量的数据集训练，LLM 已经拥有了“聪明的大脑”，只是缺少相关的知识。

RAG 正是在调用 LLM 前，先检索外部数据，将查询到的知识一并传给 LLM，弥补 LLM 对问题上下文及相关领域知识的不足，充分利用 LLM 的推理能力。

这就好比学生时代的开卷考试，可以查阅参考资料作答。这考察的是学生的推理能力，而不是相关领域的知识储备，而这也是 RAG 的核心思想。

另外，将领域知识与 LLM 训练解耦开，可以在保证 LLM 推理能力的同时，轻松适应不断更新的知识。与传统通过微调模型来适应特定领域知识的做法相比，RAG 更简单方便。

一个完整的 RAG 系统流程如下：

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/91024e65c8a04d2da7de51ca4c8cdfae~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1674&h=1066&s=467449&e=png&b=fefdfd" alt=""  /></p>

从上面流程图中，可以看到 RAG 系统包括 5 个步骤：

1.  **数据加载（Document Loading）**：从指定外部存储中获取数据。
1.  **数据切割（Splitting）**：将大文档数据切割成小数据块。
1.  **文本嵌入（Embedding）**：使用嵌入模型，将数据块进行向量化。
1.  **向量存储（Vector Storage）**：选择一种向量化数据库存储嵌入数据。
1.  **检索（Retrieval）**：从向量数据库中检索问题，获取相关文档知识。




LangChain 为上面所有步骤都提供了不同的组件和工具，我们可以很轻松地构建满足自己场景需求的 RAG 系统。

今天，我们先介绍 **`数据加载`**。

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/dbae2fc8252345cf9883b657aa22dcc7~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1732&h=1130&s=476776&e=png&b=fefdfd" alt=""  /></p>


<p align=center><img src="https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/71ff212a654942488937d7ee997e4b7f~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1556&h=734&s=92426&e=png&b=ffffff" alt="image.png"  /></p>



## 文档加载器介绍

用户的外部数据具有多样性。

1.  数据来源多样：本地、在线或者数据库等多种来源。
1.  数据格式多样：pdf、html、json、txt、markdown 等多种数据格式。
1.  操作多样：不同来源不同格式的数据，可能有不同的访问和读取方式。

为了更高效地加载和处理文档数据，LangChain 设计了一个统一的接口（`BaseLoader`）来加载和解析文档。

```python
class BaseLoader(ABC):
    ...
    @abstractmethod
    def load(self) -> List[Document]:
      ...
    ...
```

在此基础上，LangChain 为不同的文档数据类型都适配了相应的 `DocumentLoader` 组件。观察上面代码可以发现，继承自`BaseLoader`的`DocumentLoader`，都必须实现`load`方法，该方法返回一个`Document`数组。

```python
class Document(Serializable):
  page_content: str
  metadata: dict = Field(default_factory=dict)
  ...
```

`Document`中有两个比较重要的属性：`page_content`表示文档内容；`metadata`表示数据的元信息，不同数据类型的元信息有可能不一样，但都有会一个`source`字段，表示文档来源。下面是一个 html 文件的 `document` 对象示例：

```python
Document(page_content='My First Heading\n\nMy first paragraph.', lookup_str='', metadata={'source': 'example_data/fake-content.html'}, lookup_index=0)
```

`DocumentLoader`通过`load`方法，将外部数据加载成`Document`数组，变成 LangChain 能够理解的数据结构，从而与其他组件无缝连接。

LangChain 中实现了很多文档加载器，你可以在[这里](https://python.langchain.com/docs/modules/data_connection/document_loaders/)和[这里](https://python.langchain.com/docs/integrations/document_loaders)找到它们。今天，我们只介绍其中比较常见的一部分。



## PyPDFLoader

pdf 是目前最常见的数据格式之一，针对 pdf 文件的加载和内容提取，LangChain 提供了足够丰富的支持。`PyPDFLoader`是其中一种比较常用的 pdf 加载器，基于`pypdf`库，可以按页读取 pdf 文件，加载后的每个`Document`对象都是一个 pdf 页，`metadata`字段中包含了页码信息。

下面演示中，我们使用介绍 ReAct 的一篇 [pdf 论文](https://arxiv.org/pdf/2210.03629.pdf)进行演示，大家可以先下载到本地。

使用`PyPDFLoader`，我们需要安装`pypdf`库：

```shell
pip install pypdf
```

```python
from langchain_community.document_loaders import PyPDFLoader
loader = PyPDFLoader("pdf_loader_demo.pdf")
pages = loader.load()
print(len(pages)) # 33，与 pdf页数一致
print(pages[0])
"""
Document(page_content='page_content='Published as a conference...', metadata={'source': 'pdf_loader_demo.pdf', 'page': 0})
"""
```

使用这种加载方法，我们能很方便地根据页码进行数据检索。

默认情况下，`PyPDFLoader`不会解析 pdf 中的图片内容，如果需要提取，可以设置`extract_images`参数为`True`。

提取图像文本依赖第三方库`rapidocr-onnxruntime`，所以我们需要提前安装：

```shell
pip install rapidocr-onnxruntime
```

```python
from langchain_community.document_loaders import PyPDFLoader
loader = PyPDFLoader("pdf_loader_demo.pdf", extract_images=True)
pages = loader.load()
print(pages[1].page_content)
"""
Published as a conference paper at ICLR 2023
Type Deﬁnition ReAct CoT
SuccessTrue positive Correct reasoning trace and facts 94% 86%
False positive Hallucinated reasoning trace or facts 6% 14%
FailureReasoning error Wrong reasoning trace (including failing to recover from repetitive steps) 47% 16%
Search result error Search return empty or does not contain useful information 23% -
Hallucination Hallucinated reasoning trace or facts 0% 56%
Label ambiguity Right prediction but did not match the label precisely 29% 28%
Table 2: Types of success and failure modes of ReAct andCoT on HotpotQA, as well as their
percentages in randomly selected examples studied by human.
...
"""
```

pdf 原文：

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/942864fda02641eb8cd3376f29415d65~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1432&h=846&s=241843&e=png&b=fefefe" alt=""  /></p>

可以看到，设置`extract_images`后，已经成功提取了原文中表格图片的内容。

除了`PyPDFLoader`，LangChain 对 pdf 还提供了其他多种 document loader，比如专门为解析数学公式的`MathpixPDFLoader`、解析速度更快的`PyMuPDFLoader`等等。大家可以点击[这里](https://python.langchain.com/docs/modules/data_connection/document_loaders/pdf)查看具体介绍。




## JSONLoader

json 是我们日常开发中使用到最多的一种数据格式，LangChain 利用 jq 第三方库，设计了`JSONLoader`。所以，使用前我们需要先安装 jq：

```shell
pip install jq
```

jq 提供了专门为操作 JSON 结构而设计的[强大查询语言](https://jqlang.github.io/jq/manual/)。我们可以通过`jq_schema`参数使用 JQ 表达式，灵活地解析和提取目标 JSON 内容。

```json
// example.json
[
    {
        "id": 1,
        "name": "张伟",
        "email": "zhangwei@example.com",
        "age": 28,
        "city": "北京"
    },
    {
        "id": 2,
        "name": "赵小刀",
        "email": "zhaoxiaodao@example.com",
        "age": 26,
        "city": "上海"
    },
    {
        "id": 3,
        "name": "李雷",
        "email": "lilei@example.com",
        "age": 32,
        "city": "深圳"
    }
]
```

```python
from langchain_community.document_loaders import JSONLoader
loader = JSONLoader(
    file_path='example.json',
    jq_schema='.[].email')

data = loader.load()
print(data)
"""
[Document(page_content='zhangwei@example.com', metadata={'source': 'example.json', 'seq_num': 1}), Document(page_content='zhaoxiaodao@example.com', metadata={'source': 'example.json', 'seq_num': 2}), Document(page_content='lilei@example.com', metadata={'source': 'example.json', 'seq_num': 3})]
"""
```



## UnstructuredFileLoader

与上面两种解析特定格式的文档加载器不同，`UnstructuredFileLoader` 会自动检测提供的文件类型。底层使用`unstructured`库，该库会分析文件内容并尝试将文件按段落划分为不同的元素并提取。

`UnstructuredFileLoader`支持`single`（默认）和`elements`两种提取模式。

1.  `single`：将整个文档数据转换成一个 `document` 对象。
1.  `elements`：将文档数据中的每个段落转换成一个 `document` 对象。

为了更好的提取效果，一般不会直接使用`UnstructuredFileLoader`，而是使用继承它的各类`UnstructuredLoader`，比如 pdf 的`UnstructuredPDFLoader`、markdown 的`UnstructuredMarkdownLoader`、html 的`UnstructuredHTMLLoader`等。

我们还是以上面的 pdf 文档为例，使用`UnstructuredPDFLoader`进行演示“非结构化”的效果。

`UnstructuredPDFLoader`所需依赖较多，我使用时根据报错提示，安装了以下库：

```shell
pip install unstructured
pip install pdf2image
pip install pdfminer.six
pip install pillow_heif
pip install unstructured_inference,pytesseract
pip install pikepdf
# mac 安装 poppler
brew install poppler
```

下面，我们看看两种模式的使用效果。

-   single 模式

```python
from langchain_community.document_loaders import UnstructuredPDFLoader
# 默认 single 模式
loader = UnstructuredPDFLoader("pdf_loader_demo.pdf")
pages = loader.load()
print(len(pages)) # 1
```

-   elements 模式

```python
from langchain_community.document_loaders import UnstructuredPDFLoader
# elements 模式
loader = UnstructuredPDFLoader("pdf_loader_demo.pdf", mode="elements")
pages = loader.load()
print(pages[10].page_content)
"""
While large language models (LLMs) have demonstrated impressive performance across
...
only one or two in-context examples.
"""
```

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/4d6dfd0bcde24552b85ef22fc849de7c~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1418&h=1154&s=258759&e=png&b=fefefe" alt=""  /></p>





## DirectoryLoader

我们的文档数据一般有多个，存放在一个目录下面，这种情况下我们不需要手动挨个加载，LangChain 已经给我们安排好了，提供了`DirectoryLoader`，可以加载指定目录中的所有文档。

`DirectoryLoader`有以下几个可选参数：

1.  `loader_cls`：`DirectoryLoader`默认使用`UnstructuredFileLoader`提取文件内容，我们可以通过`loader_cls`参数指定文档加载器。
1.  `glob`：该参数用来控制加载目录中哪些类型的文件，比如：只加载目录中的 .md 文件，`glob="*.md"`；只加载 pdf 文件，`glob="*.pdf"`。
1.  `use_multithreading`：默认情况下，使用一个线程进行整个目录文件的加载，`use_multithreading`设置为 true 时允许多线程加载，可加快加载效率。

我们将上面的 pdf_loader_demo.pdf 移动到 src 目录下，尝试通过`DirectoryLoader`加载整个 src 目录。

```python
from langchain_community.document_loaders import DirectoryLoader, PyPDFLoader
loader = DirectoryLoader("src/", glob="*.pdf", loader_cls=PyPDFLoader)

data = loader.load()
print(len(data)) # 33
```

我们指定加载 src 目录下的 pdf 文件，并使用`PyPDFLoader`提取文档数据。



## WebBaseLoader

WebBaseLoader 类是一个用于加载和解析网页的加载器。使用 `urllib` 库加载 HTML 页面，并使用 `BeautifulSoup` 库来解析这些页面。

`BeautifulSoup`库是一个用于解析 HTML 和 XML 文档的 Python 库，通过将 HTML 文件构建成一个树状结构，并提供一套简单的方法来定位页面元素，可以方便地提取和操作页面数据。`BeautifulSoup`更详细教程可点击[这里](https://beautiful-soup-4.readthedocs.io/en/latest/#quick-start)。

```python
import bs4
from langchain_community.document_loaders import WebBaseLoader
loader = WebBaseLoader(
    web_path="https://www.gov.cn/jrzg/2013-10/25/content_2515601.htm",
    bs_kwargs=dict(parse_only=bs4.SoupStrainer(
            class_=("p1")
        ))
)
docs = loader.load()
```

上面代码片段是我们在[《LangChain 快速开发基于本地知识库的智能问答机器人》](https://juejin.cn/book/7352849785881591823/section/7353072935130628147)中使用过的，用于加载消费者权益保护法页面内容。

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/4301f160897e4a16bbec626153a89a64~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1280&h=733&s=271826&e=png&b=cad9ef" alt=""  /></p>

经过检查该页面的元素结构后，锁定内容位于`class = "p1"`的元素中，我们创建过滤条件并赋值给`bs_kwargs`，这样，加载器就只会提取`class = "p1"`的元素内容。



## SeleniumURLLoader

`WebBaseLoader`对于提取静态网页内容非常有效，但当遇到包含动态元素，需要经过浏览器渲染才能获取到网页内容的情况，`WebBaseLoader`就无能为力了。

因为当请求动态网页链接时，服务端返回 JavaScript 文件和不完整甚至是空的 HTML 结构，由浏览器执行 JavaScript，渲染并填充网页内容。而`WebBaseLoader`在服务器返回后，就立即解析返回的 HTML 文件，这时肯定就获取不到数据了。

而且，当目标网页需要登录才能访问时，WebBaseLoader 也束手无策了。

对此，LangChain 提供了`SeleniumURLLoader`，它基于`selenium`，这是一个自动化测试 python 库，能够创建一个浏览器实例来执行 JavaScript 文件，渲染网页，并允许我们通过代码来模拟真实用户的行为。这样，等到页面数据渲染完成，再进行数据提取，我们就可以成功加载到页面的数据了。

但是，`SeleniumURLLoader`实现得过于简单，实际效果并不理想。我们看看`load`方法的实现：

```python
class SeleniumURLLoader(BaseLoader):
  ...
  def load(self) -> List[Document]:
    from unstructured.partition.html import partition_html
        docs: List[Document] = list()
        driver = self._get_driver()

        for url in self.urls:
            try:
                driver.get(url)
                page_content = driver.page_source
                elements = partition_html(text=page_content)
                text = "\n\n".join([str(el) for el in elements])
                metadata = self._build_metadata(url, driver)
                docs.append(Document(page_content=text, metadata=metadata))
            except Exception as e:
                if self.continue_on_failure:
                    logger.error(f"Error fetching or processing {url}, exception: {e}")
                else:
                    raise e

        driver.quit()
        return docs
```

在 load 方法中，仅是简单使用`driver.get`方法获取 url 内容，之后没有任何等待时间就获取页面内容（`driver.page_source`），这存在两个问题：

1.  渲染动态资源需要时间，`driver.get`后直接获取内容，可能获取不到完整的页面数据。
1.  对于复杂业务场景，比如需要模拟用户操作、指定某些元素内容，这些 selenium 擅长的功能，在`SeleniumURLLoader`中都被阉割掉了。

所以，我并不推荐直接使用`SeleniumURLLoader`，它虽然引入了 selenium，但却无法利用到其强大的加载功能，反而创建浏览器实例会消耗更多资源。

在这里，我给一个优化后的`NewSeleniumURLLoader`，不一定是最完美的解决方案，仅供大家参考：

```python
class NewSeleniumURLLoader(BaseLoader):
   # 省略部分与SeleniumURLLoader一致
   ...
  def __init__(..., handler: Callable[[WebDriver,str] str] = None):
    ...
    self.handler = handler or self._default_handler
  # 默认处理器，调用driver.get方法后立即获取页面内容
  def _default_handler(self, driver: WebDriver, url: str) -> str:
    driver.get(url)
    return driver.page_source
  def load(self) -> List[Document]:
    from unstructured.partition.html import partition_html
    docs: List[Document] = list()
    driver = self._get_driver()

    for url in self.urls:
        try:
            # 调用自定义处理器，允许用户自定义加载页面内容的逻辑
            page_content = self.handler(driver, url)
            # 下面的逻辑与SeleniumURLLoader一致
            elements = partition_html(text=page_content)
            text = "\n\n".join([str(el) for el in elements])
            metadata = self._build_metadata(url, driver)
            docs.append(Document(page_content=text, metadata=metadata))
        except Exception as e:
            if self.continue_on_failure:
                logger.error(f"Error fetching or processing {url}, exception: {e}")
            else:
                raise e

    driver.quit()
    return docs
```

`SeleniumURLLoader`的问题在于把获取页面内容逻辑与转换页面内容为 documnet 对象的逻辑耦合在一起了，所以，我们提供了一个自定义处理器，允许用户自定义加载页面内容的逻辑。




## 总结

1.  为了弥补 LLM 无法对训练集以外知识生成准确答案的局限，RAG 通过数据加载、数据切割、文本嵌入、向量存储和检索五个步骤，为 LLM 提供外部数据，充分利用 LLM 的推理能力，使其能够生成更准确和符合上下文的答案。

2.  LangChain 提供了一系列文档加载器，用于处理不同来源和格式的数据。今天主要介绍了用于加载 PDF 文件的`PyPDFLoader`、用于加载和解析 JSON 数据的`JSONLoader`、非结构化提取文件的`UnstructuredFileLoader`、加载指定目录下的多个文档的`DirectoryLoader`以及用于获取 url 资源的`WebBaseLoader`和`SeleniumURLLoader`。不同的文档加载器适用于不同的场景，学会选择合适的加载器加载文档，对构造一个强大、稳定的 RAG 系统很有帮助。