大家好，欢迎继续学习 LangChain 实战课程。

上一节课我们已经介绍了如何使用 Langchain 来加载外部的文档，今天，我们继续学习构建 RAG 的下一环节 —— **文档分割。**

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/b607d7f3741841b09b1ea9e296542e93~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1700&h=1110&s=474216&e=png&b=fefdfd" alt=""  /></p>

我们会从为什么要分割、有哪些分割策略以及如何选择策略进行分割几个角度，介绍分割如何提供我们 RAG 应用检索的效率和准确性。


<p align=center><img src="https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/a69126110e0a4eee90fa725ff40217ad~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1792&h=808&s=101653&e=png&b=fdf7f6" alt="image.png"  /></p>




## 为什么需要分割

**文档分割，是指将加载的文档分成更小片块的过程。**

我们在上一节课中其实已经有接触过了，比如`PyPDFLoader`将整个数据按页加载成多个文档块；`UnstructuredFileLoader`的`elements`模式，将整个数据按元素分块加载。

我们再复习下整个 RAG 的过程，若不考虑文档分割，加载的文档，会先使用嵌入模型进行向量化，存入向量化数据库，之后被检索，再与用户问题一并提交给 LLM。这样看下来流程也是通的，那为什么还需要分块呢？

1.  **文档嵌入**：文档向量化，是指提取数据特征，压缩、降低维度，转换为一组数值数组或矩阵的向量形式。文档越大，向量化后丢失的信息就越多，会严重影响后续的检索效果。此外，不同的嵌入模型，在不同大小的文档块上表现的性能和效率不同。比如句子嵌入模型在处理单个句子时表现更佳，而 OpenAI 的 text-embedding-ada-002 嵌入模型在包大小为 256 或 512 个标记的块上表现更好。

3.  **存储向量数据库**：大文档块向量化后的维度值会比小文档块的更多，这对向量化数据库也是一个挑战，会增加存储空间和计算资源，同时降低数据检索的性能和效率。
4.  **检索**：根据用户问题检索文档数据，如果单个文档数据过大，检索结果的相关性会较低。比如，一份 1000 字的文档数据，只顺嘴提了 50 个字的编程话题，这时用户输入与编程相关的话题，就可能会把整个大文档返回。文档的相关性会直接影响 LLM 的输出结果的准确性。
5.  **LLM 调用**：目前的 LLM 模型，都对单次请求发送的 token 数量有限制，整份文档数据有可能超出模型的限制。当然，这个随着 LLM 的发展，限制会越来越小，比如国产大模型 kimi，最近发布已经能支持 200 万中文上下文了，这大概是 GPT-4 Turbo 的 32 倍！

所以，文档分割，在构建 RAG 应用中必不可少，分割的目的是数据块足够小的同时，文档块的语义仍保持相关。

这两者很矛盾，分割的太小，就有可能导致丢失上下文信息，文档块的语义就不完整。比如：“小明喜欢小红，他还喜欢小青”，如果这个文档被分为两个文档块：“小明喜欢小红”、“他还喜欢小青”。根据问题：“小明喜欢谁？”，就只能检索到“小明喜欢小红”，丢失了他另外一个爱人“小青”。

所以，文档分割需要根据应用场景进行权衡的考虑，LangChain 提供了一系列文档分割方法可供我们选择，下面，我们将对其中几种常见的策略进行详细讲解。




## LangChain 中常见的分割策略

langchain 中的分割器位于 langchain_text_splitters 库中，我们需要手动安装：

```shell
pip install langchain_text_splitters
```

大部分文档分割器都是继承自`TextSplitter`，我们先看下`TextSplitter`的几个关键代码：

```python
class TextSplitter(BaseDocumentTransformer, ABC):
    # 初始化分割器
    def __init__(
        self,
        # 分割后每个文档块的大小
        chunk_size: int = 4000,
        # 前后两段字符串重叠的字符数量
        chunk_overlap: int = 200,
        ...
    ) -> None:
    
    @abstractmethod
    def split_text(self, text: str) -> List[str]:
        """Split text into multiple components."""

    # 将多个文本按策略分割成文档列表
    def create_documents(
        self, texts: List[str], metadatas: Optional[List[dict]] = None
    ) -> List[Document]:
        _metadatas = metadatas or [{}] * len(texts)
        documents = []
        for i, text in enumerate(texts):
            ...
            # 调用split_text，将大文本分割成多个小文本
            for chunk in self.split_text(text):
                metadata = copy.deepcopy(_metadatas[i])
                ...
                # 封装成document对象
                new_doc = Document(page_content=chunk, metadata=metadata)
                documents.append(new_doc)
        return documents
 
    # 将多个文档按策略分割成多个文档列表
    def split_documents(self, documents: Iterable[Document]) -> List[Document]:
        texts, metadatas = [], []
        for doc in documents:
            texts.append(doc.page_content)
            metadatas.append(doc.metadata)
        return self.create_documents(texts, metadatas=metadatas)
    
    def _merge_splits(self, splits: Iterable[str], separator: str) -> List[str]:
    
```


`create_documents`和`split_documents`是我们在实际开发过程中使用比较多的两个方法，都可以用来创建`Document`列表。其中`split_documents`先获取传入的`documents`的文本信息`page_content`和元信息`metadata`，然后调用`create_documents`进行重新分割。


`create_documents`最终调用`split_text`进行分割，`TextSplitter`本身没有实现`split_text`，需要各自的文档分割器按自己的分割策略实现分割逻辑。


我们再看下初始化`TextSplitter`时传入的`chunk_size`和`chunk_overlap`两个参数。

-   `chunk_size`：限制被分割后每个文档块的大小。
-   `chunk_overlap`：前后两个文档块重叠的最大字符数量。

`chunk_overlap`是为了保证文档块语义的连贯性和完整性，还是以前面示例文档“小明喜欢小红，他还喜欢小青”为例，根据分割策略分割成两个文档块： “小明喜欢小红”和“他还喜欢小青”，这个时候如果设置`chunk_overlap > 0`， 会将两个文档再合并为一个文档：“小明喜欢小红，他还喜欢小青”，这样，文档语义就变完整了。

合并方法是由`TextSplitter`提供的`_merge_splits`，这个方法会根据`chunk_size`和`chunk_overlap`对传入的文本列表尽可能合并，合并规则如下：

-   文档块 > `chunk_size`，不合并

-   `chunk_overlap` < 文档块 < `chunk_size`

    -   文档块 + 后续文档块 > `chunk_size`，不合并
       ![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/3dc80b3d033d4f2db9178fa91a050ed8~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=828&h=370&s=26577&e=png&b=ffffff)
    -   文档块 + 后续文档块 <= `chunk_size`，合并

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/6ef6c0ae2fa54026b2739f70cb972970~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=840&h=384&s=34532&e=png&b=ffffff)

-   文档块 < `chunk_overlap`

    -   相邻文档 + 文档块 > `chunk_size`，不合并
       ![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/6d63bf812c2b49788b336dc4c4590aa9~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=880&h=458&s=43746&e=png&b=ffffff)
    -   前面文档 + 文档块 <= `chunk_size`，与前后合并
       ![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e67329845259417eac128c7c0475c7cf~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1042&h=560&s=59800&e=png&b=ffffff)

从上面的图示中可以发现，`_merge_splits`可以将按分割策略（一般是按特定分割符分割）分割后的较小文档，合并成尽可能不超过`chunk_size`的文档（特殊情况还是会超过`chunk_size`，见上面最后一幅图中的 BC 块）。

同时，那些特别小的文档（小于`chunk_overlap`），还可能被前后文档合并，使前后文档有一定重叠，保持语义连贯性。




需要注意的是，`_merge_splits`在合并时是有考虑分割符的长度的。假设上图中的分割符为 "\n\n"，上图中的文档块 A 长度 60，其中包含了 2 个字符的分割符，也就是说实际内容长度只有 58。

`_merge_splits`是可选的，各个分割器可以根据自己的需求，在`split_text`方法中选择是否调用。

至此，LangChain 中`TextSplitter`的基本原理和架构就算介绍完了，我们再看下完整的代码结构：

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/d358def0198b4a4abf022224f0c89c92~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1496&h=960&s=105871&e=png&b=ffffff" alt=""  /></p>

下面，我们将从简单到复杂，介绍 LangChain 中常见的几种文档分割器。



### 字符文本分割

按字符分割，是最简单的一种分割策略，我们指定一个分割符，然后将文本按这个分割符进行分割。在 LangChain 中，这个分割策略对应的分割器为`CharTextSplitter`。

```python
class CharTextSplitter(TextSplitter):
    def __init__(
        self,
        ...
        # 指定分割符
        separator: str = "\n\n",
    ) -> None:

    def split_text(self, text: str) -> List[str]:
      # 获取分割符
      separator = (
            self._separator if self._is_separator_regex else re.escape(self._separator)
      )
      # 按分割符分割文本
      splits = _split_text_with_regex(text, separator, self._keep_separator)
      _separator = "" if self._keep_separator else self._separator
      # 调用TextSplitter._merge_splits合并分割后的文本
      return self._merge_splits(splits, _separator)
```

`CharTextSplitter`默认按换行符`\n\n`进行分割。下面我们看下具体的效果，为了避免`_merge_splits`合并文档，我们将`chunk_size`和`chunk_overlap`设置得特别小。

```python
from langchain_text_splitters import CharacterTextSplitter
splitter = CharacterTextSplitter(
    chunk_size=1,
    chunk_overlap=0
)
 
text = '666666\n\n333\n\n22'
print(splitter.split_text(text))
"""
['666666', '333', '22']
"""
```

  


### 分句分割

前面提到过，某些嵌入模型对单个句子的嵌入进行了专门的优化，所以，有些情况下，我们会将数据按句子进行分割。

NLTK 和 spaCy 是两个流行的自然语言处理 python 库，它们都提供了丰富的工具和功能来分析和处理文本数据。LangChain 利用这两个库，分别设计了`NLTKTextSplitter`和`SpacyTextSplitter`。

-   **`NLTKTextSplitter`**

NLTK 是 Python 中最早的 NLP 库之一，提供了多种语言处理任务的工具，包括分词、词性标注、命名实体识别、句法分析等。LangChain 利用 NLTK 库中的分句器来实现文本的分句操作。

```python
class NLTKTextSplitter(TextSplitter):
    """Splitting text using NLTK package."""
    def __init__(
        self, separator: str = "\n\n", language: str = "english", **kwargs: Any
    ) -> None:
        ...
        from nltk.tokenize import sent_tokenize
        self._tokenizer = sent_tokenize
        ...
        self._separator = separator
        self._language = language
    
    def split_text(self, text: str) -> List[str]:
    """Split incoming text and return chunks."""
        # 使用分句器进行分句
        splits = self._tokenizer(text, language=self._language)
        # 调用TextSplitter._merge_splits,对分割后的句子进行合并
        return self._merge_splits(splits, self._separator)
```



`NLTKTextSplitter`在用分句器分句后，也会调用`TextSplitter._merge_splits`进行合并。

```python
from langchain_text_splitters import NLTKTextSplitter
splitter = NLTKTextSplitter(
    chunk_size=1,
    chunk_overlap=0
)

text = 'This is a test sentence for testing NLTKTextSplitter! It will be splitted to several sub sentences, let see how it works.'
print(splitter.split_text(text))
"""
['This is a test sentence for testing NLTKTextSplitter!', 'It will be splitted to several sub sentences, let see how it works.']
"""
```

可以看到，`NLTKTextSplitter`能自动区分不同的标点符号，当遇到完整句子的符号（问号、句号、感叹号等）会自动分句。

-   **`SpacyTextSplitter`**

`nltk`在处理大型文本时，速度会较慢。`nltk`更多的是面向教学场景。

`spacy`是使用 C++ 开发的一个 python 库，速度更快。并经过专门的优化，更适合用于生产环境。此外，使用了更新的算法和预训练模型，能提供更高准确度的分割。提供更有效的并行处理和更好的内存管理方案，更适合处理大型数据集。

使用`SpacyTextSplitter`前，我们除了要提前安装`spacy`库，还需要先安装使用的模型。`SpacyTextSplitter`默认使用的是`en_core_web_sm`模型，我们下面演示下在正常 python 环境和使用 pdm 管理项目环境时分别如何安装模型：

-   正常 python 环境

```shell
   python -m spacy download en_core_web_sm
```

-   使用 pdm 管理

```shell
pdm add https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.7.1/en_core_web_sm-3.7.1.tar.gz
```

上面的 URL 可以根据实际情况替换为所需模型的实际版本号。查看 [spaCy 模型的官方发布页面](https://github.com/explosion/spacy-models/releases/) 可以找到正确的版本号和下载链接。

下载完模型后，SpacyTextSplitter 的使用就非常简单了：

```python
from langchain_text_splitters import SpacyTextSplitter

splitter = SpacyTextSplitter(
    chunk_size=1,
    chunk_overlap=0
)

text = 'This is a test sentence for testing NLTKTextSplitter! It will be splitted to several sub sentences, let see how it works.'
print(splitter.split_text(text))
"""
['This is a test sentence for testing NLTKTextSplitter!', 'It will be splitted to several sub sentences, let see how it works.']
"""
```

  


### 递归字符文本分割

`CharTextSplitter`的问题在于只指定了一个分割符，有可能导致分出来的文档块比预期设定的`chunk_size`大得多。`RecursiveCharacterTextSplitter`可以有效避免这个问题，它允许我们指定一组分割符，在使用第一个分割符分割文档后，如果没有分割成预期大小的块，会递归使用其他分割符对生成的块再次分割，直到文档块达到预期或分割符全部尝试为止。

`RecursiveCharacterTextSplitter`的默认分割符列表是`["\n\n", "\n", " ", ""]`。

以下是使用`RecursiveCharacterTextSplitter`的示例：

```python
from langchain_text_splitters import RecursiveCharacterTextSplitter

splitter = RecursiveCharacterTextSplitter(
    chunk_size=5,
    chunk_overlap=1
)

# 下面text是一段测试RecursiveCharacterTextSplitter的文本
text = "This is a test text for the RecursiveCharacterTextSplitter. It is a long text with many words."
print(splitter.split_text(text))
"""
['This', 'is a', 'test', 'text', 'for', 'the', 'Recu', 'ursiv', 'veCha', 'aract', 'terTe', 'extSp', 'plitt', 'ter.', 'It', 'is a', 'long', 'text', 'with', 'many', 'word', 'ds.']
"""
```

可以看到，默认分割符`""`确保最终能生成所需大小的文档块。**但也可能会文档块的语义不明，我们需要根据实际情况决定是否使用。**

`RecursiveCharacterTextSplitter`多个分割符递归分割文档的能力赋予了其广泛的使用空间，我们可以用它来分割不同编程语言的代码文件。

`langchain_text_splitters.Language`列举了 LangChain 支持分割的语言列表。

```python
from langchain_text_splitters import Language
print([e.value for e in Language])
"""
['cpp', 'go', 'java', 'kotlin', 'js', 'ts', 'php', 'proto', 'python', 'rst', 'ruby', 'rust', 'scala', 'swift', 'markdown', 'latex', 'html', 'sol', 'csharp', 'cobol', 'c', 'lua', 'perl']
"""
```

LangChain 为不同语言预设了不同的分割符列表。

```python
from langchain_text_splitters import (
    Language,
    RecursiveCharacterTextSplitter,
)

print(RecursiveCharacterTextSplitter.get_separators_for_language(Language.PYTHON))
"""
['\nclass ', '\ndef ', '\n\tdef ', '\n\n', '\n', ' ', '']
"""
```

我们可以使用`RecursiveCharacterTextSplitter.from_language`创建指定语言的分割器：根据指定语言获取对应的分割符列表，然后用该列表实例化一个`RecursiveCharacterTextSplitter`对象。

```python
class RecursiveCharacterTextSplitter(TextSplitter):
    @classmethod
    def from_language(
        cls, language: Language, **kwargs: Any
    ) -> RecursiveCharacterTextSplitter:
        separators = cls.get_separators_for_language(language)
        return cls(separators=separators, is_separator_regex=True, **kwargs)
```

我们看下 python 代码的分割效果：

```python
from langchain_text_splitters import Language,RecursiveCharacterTextSplitter

code = """
def hello_world():
    print("Hello World!")

if __name__ == '__main__':
    hello_world()
"""

python_splitter = RecursiveCharacterTextSplitter.from_language(
    language=Language.PYTHON, chunk_size=50, chunk_overlap=0
)

python_chunks = python_splitter.split_text(code)
print(python_chunks)
"""
['def hello_world():\n    print("Hello World!")', "if __name__ == '__main__':\n    hello_world()"]
"""
```



### 语义分割

上面介绍的分割策略中，都有一个明显的缺点：**分割没有考虑文本的语义完整和连贯**。

`NLTKTextSplitter`和`SpacyTextSplitter`虽然能准确对文档分句处理，但也仅此而已。还是拿小明的感情举例：“小明喜欢小红。他还喜欢小青”。这个文本由于中间使用句号，无论是`NLTKTextSplitter`还是`SpacyTextSplitter`，都会将其分割为两个小文档块，但它们其实是语义强相关的，把它们当成一个文档会更合理。

至于其它分割策略更不用说了，只是简单按预定的分割符对文本进行分割。

那有没有一种方法，能将语义相近的内容放一起当成一个文档块？LangChain 参考[这篇文章](https://github.com/FullStackRetrieval-com/RetrievalTutorials/blob/main/tutorials/LevelsOfTextSplitting/5_Levels_Of_Text_Splitting.ipynb)，实现了`SemanticChunker`。它先对整个文本进行分句处理，然后利用嵌入模型，计算每个句子的向量值，通过比较相邻句子之间的余弦距离来判断句子的语义相似性，决定是否要合并。

-   分句处理

`SemanticChunker`中直接使用 `'.'`, `'?',` 和 `'!'`将输入的文本分割成块。

> 可以发现，这里没有考虑中文断句符号，所以在使用`SemanticChunker`处理中文时，需要特别注意修改这里的分割符。

```python
class SemanticChunker(BaseDocumentTransformer):
    def split_text(
        self,
        text: str,
    ) -> List[str]:
        # Splitting the essay on '.', '?', and '!'
        single_sentences_list = re.split(r"(?<=[.?!])\s+", text)
        ...
```

-   初步合并句子，保持句子之间的连续性，作用类似于上面的`chunk_overlap`。

`SemanticChunker`会基于一个可配置的参数`buffer_size`，将相邻句子合并。默认`buffer_size = 1`。比如，经过第一步分割后得到 A、B、C、D 四个块，`buffer_size = 1`，会合并成 AB、ABC、BCD、CD 四个块。即一个句子块与前后`buffer_size`个句子合并。

```python
def combine_sentences(sentences: List[dict], buffer_size: int = 1) -> List[dict]:
    # 遍历每个句子
    for i in range(len(sentences)):
        # 创建一个将保存被连接句子的字符串
        combined_sentence = ""

        # 根据buffer_size大小，添加当前句子之前的的句子。
        for j in range(i - buffer_size, i):
            # 检查索引j是否不为负数
            # （避免像第一个句子那样出现索引越界）
            if j >= 0:
                # 将索引j处的句子添加到combined_sentence字符串
                combined_sentence += sentences[j]["sentence"] + " "

        # 添加当前句子
        combined_sentence += sentences[i]["sentence"]

        # 根据buffer_size大小，添加当前句子之后的句子
        for j in range(i + 1, i + 1 + buffer_size):
            # 检查索引j是否在句子列表的范围内
            if j < len(sentences):
                # 将索引j处的句子添加到combined_sentence字符串
                combined_sentence += " " + sentences[j]["sentence"]

        # 然后将整个内容添加到你的字典中
        # 将合并后的句子存储在当前句子字典中
        sentences[i]["combined_sentence"] = combined_sentence
    return sentences
```

-   使用嵌入模型，计算每个块的向量值。

```python
embeddings = self.embeddings.embed_documents(
            [x["combined_sentence"] for x in sentences]
        )
for i, sentence in enumerate(sentences):
    sentence["combined_sentence_embedding"] = embeddings[i]
```

-   计算每个块与下一个块之间的余弦距离，并记录到`distance_to_next`中。

```python
def calculate_cosine_distances(sentences: List[dict]) -> Tuple[List[float], List[dict]]:
    """计算句子间的余弦距离。"""
    distances = []
    for i in range(len(sentences) - 1):
        # 获取当前句子和下一个句子的嵌入向量
        embedding_current = sentences[i]["combined_sentence_embedding"]
        embedding_next = sentences[i + 1]["combined_sentence_embedding"]

        # 计算余弦相似度
        similarity = cosine_similarity([embedding_current], [embedding_next])[0][0]

        # 将余弦相似度转换为余弦距离
        distance = 1 - similarity

        # 将余弦距离添加到列表中
        distances.append(distance)

        # 存储距离
        sentences[i]["distance_to_next"] = distance
    return distances, sentences
```

现在，我们就得到了块与块之间的余弦距离数组。

```python
print(distances)
"""
[0.08081114249044896, 0.02726339916925502, 0.04722227403602797]
"""
```

画成图比较直观：

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/85b98f25b5d04014a082ac732314bc9a~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1636&h=834&s=341879&e=png&b=fefefe" alt=""  /></p>

<p align=center>[图示出自实现原理文章]</p>

-   设置断点

余弦距离越大，表示文档块之间语义越不相关。我们可以设置一个断点阈值，遍历句子块，如果与下个句子的余弦距离较小，则合并成块，直到余弦距离超过阈值。

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/a8b76dc428254814bbf9846a32875b8c~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1624&h=904&s=450528&e=png&b=f4ebe8" alt=""  /></p>

<p align=center>[图示出自实现原理文章]</p>

`SemanticChunker`目前支持 Percentile（百分位数）、Standard Deviation （标准差）、Interquartile （四分位数）三种阈值的计算方式：

```python
BREAKPOINT_DEFAULTS: Dict[BreakpointThresholdType, float] = {
    "percentile": 95,
    "standard_deviation": 3,
    "interquartile": 1.5,
}

class SemanticChunker(BaseDocumentTransformer):
    def __init__(
        ...
        breakpoint_threshold_type: BreakpointThresholdType = "percentile",
        breakpoint_threshold_amount: Optional[float] = None,
        ...
    ):
        self.breakpoint_threshold_type = breakpoint_threshold_type
        if breakpoint_threshold_amount is None:
            self.breakpoint_threshold_amount = BREAKPOINT_DEFAULTS[
                breakpoint_threshold_type
            ]
        else:
            self.breakpoint_threshold_amount = breakpoint_threshold_amount
    
    # 计算断点阈值
    def _calculate_breakpoint_threshold(self, distances: List[float]) -> float:
        if self.breakpoint_threshold_type == "percentile":
            return cast(
                float,
                np.percentile(distances, self.breakpoint_threshold_amount),
            )
        elif self.breakpoint_threshold_type == "standard_deviation":
            return cast(
                float,
                np.mean(distances)
                + self.breakpoint_threshold_amount * np.std(distances),
            )
        elif self.breakpoint_threshold_type == "interquartile":
            q1, q3 = np.percentile(distances, [25, 75])
            iqr = q3 - q1

            return np.mean(distances) + self.breakpoint_threshold_amount * iqr
```

`SemanticChunker`默认的计算方式是 Percentile（百分位数），我们可以在初始化时传入`breakpoint_threshold_type`修改。

针对每种计算方式，都有一个系数`breakpoint_threshold_amount`，用于影响最终的阈值。以下针对代码，简单解释下每种计算方式。

-   `percentile`

百分位数表示在一组观测值中，有多大比例的数值低于这个百分位数值。例如，50 百分位数（也称为中位数）表示有一半的观测值低于这个数值，另一半的观测值高于这个数值。

默认情况下，`percentile`的`breakpoint_threshold_amount` = 95，也就是说，阈值定为 95 百分位数。

  


-   `standard_deviation`

标准差表示数据集中各个数值与平均值的偏差程度。标准差越大，数据分布越分散；标准差越小，数据分布越集中。

`np.mean(distances) + self.breakpoint_threshold_amount * np.std(distances)`将平均值与标准差相加得到阈值，其中，`breakpoint_threshold_amount`用于调整标准差在计算中的敏感程度。

  


-   `interquartile`

四分位数指的是将数据集分为四个等分，通过三个点（25% 百分位数 q1、50 百分位数 q2、75 百分位数 q3）将数据进行四等分。每个部分包含 25% 的数据。

还有一个四分位距（IQR）的概念，是`q3`和`q1`之间的差值，用于描述数据集中间 50% 数据分布范围的统计量。

在`SemanticChunker`中，先是计算了四分位距 `iqr`，将`iqr`与`breakpoint_threshold_amount`相乘，再与平均值相加，得到一个调整后的加权平均值。




**需要注意，这种语义分割的效果未经过多实际场景验证，所以 LangChain 目前将`SemanticChunker`放到了`langchain_experimental`包中。**

下面，我们以 langchain 官网的一段文本演示，来看下`SemanticChunker`的效果。

```python
text = """
LangChain is a framework for developing applications powered by language models. It enables applications that:

Are context-aware: connect a language model to sources of context (prompt instructions, few shot examples, content to ground its response in, etc.)
Reason: rely on a language model to reason (about how to answer based on provided context, what actions to take, etc.)
This framework consists of several parts.

LangChain Libraries: The Python and JavaScript libraries. Contains interfaces and integrations for a myriad of components, a basic run time for combining these components into chains and agents, and off-the-shelf implementations of chains and agents.
LangChain Templates: A collection of easily deployable reference architectures for a wide variety of tasks.
LangServe: A library for deploying LangChain chains as a REST API.
LangSmith: A developer platform that lets you debug, test, evaluate, and monitor chains built on any LLM framework and seamlessly integrates with LangChain.
"""
```

```
from langchain_openai import OpenAIEmbeddings
from langchain.embeddings import CacheBackedEmbeddings

text_splitter = SemanticChunker(embeddings = OpenAIEmbeddings())
chunks = text_splitter.split_text(text)
print(len(chunks)) # 2
print(chunks)
"""
['\nLangChain is a framework for developing applications powered by language models. It enables applications that:\n\nAre context-aware: connect a language model to sources of context (prompt instructions, few shot examples, content to ground its response in, etc.)\nReason: rely on a language model to reason (about how to answer based on provided context, what actions to take, etc.)\nThis framework consists of several parts. LangChain Libraries: The Python and JavaScript libraries.', 
 'Contains interfaces and integrations for a myriad of components, a basic run time for combining these components into chains and agents, and off-the-shelf implementations of chains and agents. LangChain Templates: A collection of easily deployable reference architectures for a wide variety of tasks. LangServe: A library for deploying LangChain chains as a REST API. LangSmith: A developer platform that lets you debug, test, evaluate, and monitor chains built on any LLM framework and seamlessly integrates with LangChain. ']
"""
```

调整初始化时的`breakpoint_threshold_type`和`breakpoint_threshold_amount`，可以得到不同的结果。

  


## 分割策略注意事项

分割策略没有银弹，不同的分割策略适用于不同的场景，我们需要结合自己的业务场景，选择合适的策略。在考虑分割策略时，需要从多个方面考虑，下面我们介绍一些注意考虑的点供大家参考：

1.  原始文档的内容类型是什么？书籍文章还是聊天消息？
1.  使用的嵌入模型是什么？不同的模型在不同大小的文档块上表现的性能和效率不同。
1.  预期的用户查询有什么特点？是简单的短句还是复杂的长句？
1.  后续使用的 LLM 模型 token 限制是多少？在多长的 token 下表现较好？

回答这些问题可以帮助我们平衡性能和准确性较好的分割策略。当然，确定分割策略也是一个迭代的过程，需要不断的调整、测试，才能达到预期的效果。




## 总结

在 LangChain 中，文档分割是一个关键步骤，它影响着 RAG 应用的检索效率和准确性。通过合理的分割策略，可以在保持文档块足够小的同时，确保文档块的语义相关性，从而提高整体的应用性能。

今天介绍了 LangChain 中实现的几种常见的分割器，我们不仅要了解它们的使用方法，更要知晓其原理，这样我们在选择或者开发自己的文档分割器时才更有把握。

制定分割策略需要综合考虑多种因素，包括文档的内容特性、使用的嵌入模型、用户的查询习惯以及 LLM 模型的限制等，以确保最终选择的策略能够满足应用的需求。此外，文档分割策略的选择和调整是一个迭代过程，需要通过不断的测试和优化来达到最佳效果。