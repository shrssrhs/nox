export default function ChatPage() {
    return (
      <main className="flex h-screen">
  
        {/* sidebar */}
  
        <aside className="w-64 border-r border-zinc-900 p-4">
  
          <h1 className="mb-8 text-xl">
            Nox
          </h1>
  
        </aside>
  
        {/* chat */}
  
        <section className="flex flex-1 flex-col">
  
          <header
            className="
              border-b
              border-zinc-900
              px-8
              py-5
            "
          >
            Spotify Clone
          </header>
  
          <div className="flex-1 overflow-auto p-8">
  
            <div className="mb-8">
              <div className="mb-2 text-xs text-zinc-500">
                Alex
              </div>
  
              <div
                className="
                  inline-block
                  rounded-2xl
                  border
                  border-zinc-900
                  px-4
                  py-3
                "
              >
                Need architecture ideas.
              </div>
            </div>
  
            <div className="text-right">
  
              <div className="mb-2 text-xs text-zinc-500">
                You
              </div>
  
              <div
                className="
                  inline-block
                  rounded-2xl
                  border
                  border-zinc-800
                  px-4
                  py-3
                "
              >
                I'll prepare a proposal.
              </div>
  
            </div>
  
          </div>
  
          <div
            className="
              border-t
              border-zinc-900
              p-6
            "
          >
  
            <input
              placeholder="Message..."
              className="
                w-full
                rounded-2xl
                border
                border-zinc-800
                bg-transparent
                px-5
                py-4
                outline-none
              "
            />
  
          </div>
  
        </section>
  
        {/* context */}
  
        <aside
          className="
            w-80
            border-l
            border-zinc-900
            p-6
          "
        >
  
          <h3 className="mb-4 text-lg">
            Context
          </h3>
  
          <div
            className="
              rounded-2xl
              border
              border-zinc-900
              p-4
            "
          >
            <p className="text-sm text-zinc-500">
              Shared Files
            </p>
  
            <div className="mt-4 space-y-2">
  
              <div>
                architecture.md
              </div>
  
              <div>
                database.sql
              </div>
  
              <div>
                notes.txt
              </div>
  
            </div>
  
          </div>
  
        </aside>
  
      </main>
    );
  }